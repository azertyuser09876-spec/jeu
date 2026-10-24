// Point d'entrée : relie la simulation, l'affichage et les contrôles, et fait tourner la boucle.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  const AUTOSAVE_EVERY = 10; // secondes

  const canvas = document.getElementById('view');
  const renderer = Vide.Render.create(canvas);
  window.addEventListener('resize', () => Vide.Render.resize(renderer));

  const loaded = Vide.Storage.load();
  const state = loaded && loaded.ok ? loaded.state : Vide.State.create((Math.random() * 2 ** 32) >>> 0);
  // Le monde a continué pendant que la page était fermée.
  const welcome = loaded && loaded.ok && loaded.savedAt
    ? Vide.Offline.apply(state, (Date.now() - loaded.savedAt) / 1000)
    : null;
  const game = Vide.Sim.create(state);
  const input = Vide.Input.create(canvas);

  // Après « recommencer », plus aucune sauvegarde ne doit réécrire l'ancienne partie.
  let resetting = false;
  function save() {
    if (!resetting) Vide.Storage.save(state);
  }

  const ui = Vide.UI.create(game, {
    onPulse: () => { input.pulse = true; },
    onAbility: (id) => { input[id] = true; },
    onBuy: () => Vide.Audio.play('buy'),
  });
  Vide.Audio.init();
  const menu = Vide.Menu.create(game, {
    onReset: () => {
      resetting = true;
      Vide.Storage.clear();
      window.location.reload();
    },
    onImport: (imported) => {
      resetting = true;
      Vide.Storage.replace(imported);
      window.location.reload();
    },
    onCinema: (id) => Vide.Cinema.play(cinema, state, id, { force: true }),
  });
  // Les tableaux : une nouvelle partie s'ouvre sur le premier, avant l'éveil.
  const cinema = Vide.Cinema.create(renderer);
  if (state.totalLight <= 0) Vide.Cinema.play(cinema, state, 'ouverture');
  const map = Vide.Map.create(game);
  Vide.Render.snapCamera(renderer, game);
  Vide.Away.init();
  // Le bilan de l'absence attend la fin de l'animation de lancement.
  let welcomePending = welcome && Vide.Offline.worthShowing(welcome) ? welcome : null;
  let intro = Vide.Intro.create('launch');

  const paused = () => menu.open || Vide.Away.open || map.open || Vide.Intro.blocking(intro) || Vide.Cinema.active(cinema);

  // Touches d'action (en plus du déplacement). Renvoie vrai si la touche a été utilisée.
  input.onAction = (code, key) => {
    // Un tableau joue : Échap, Espace ou Entrée le passe ; le reste attend.
    if (Vide.Cinema.active(cinema)) {
      if (code === 'Escape' || code === 'Space' || code === 'Enter') Vide.Cinema.skip(cinema);
      return true;
    }
    if (Vide.Intro.blocking(intro)) {
      Vide.Intro.skip(intro);
      return true;
    }
    const isMapKey = key === 'm' || key === 'M';
    if (map.open) {
      if (code === 'Escape' || isMapKey) Vide.Map.toggle(map, false);
      return true;
    }
    if (Vide.Away.open) {
      if (code === 'Escape' || code === 'Enter' || code === 'Space') Vide.Away.close();
      return true;
    }
    if (code === 'Escape') {
      Vide.Menu.toggle(menu);
      return true;
    }
    if (menu.open) return false;
    if (code === 'Space') {
      input.pulse = true;
      return true;
    }
    if (code === 'Tab') return Vide.UI.nextTab(ui);
    // Capacités : Maj (ruée), F (fanal), R (retour) — par position de touche, quel que soit le clavier.
    const ability = { ShiftLeft: 'dash', ShiftRight: 'dash', KeyF: 'beacon', KeyR: 'recall' }[code];
    if (ability) {
      input[ability] = true;
      return true;
    }
    if (key === '+' || key === '=' || code === 'NumpadAdd') {
      Vide.Render.zoomBy(renderer, 1.15);
      return true;
    }
    if (key === '-' || code === 'NumpadSubtract') {
      Vide.Render.zoomBy(renderer, 1 / 1.15);
      return true;
    }
    if (isMapKey && state.zones.visited.length > 1) {
      Vide.Map.toggle(map, true);
      return true;
    }
    const posture = { KeyG: 'garde', KeyE: 'escorte', KeyC: 'chasse', KeyB: 'siege' }[code];
    if (posture && Vide.Combat.armySize(state) > 0) return Vide.Combat.setPosture(state, posture);
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (digit) return Vide.UI.buyByIndex(ui, Number(digit[1]));
    return false;
  };

  // Sauvegarde quand on quitte ou change d'onglet (seul moment fiable sur mobile).
  // Au retour sur l'onglet, le temps passé ailleurs compte comme une absence.
  let hiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      save();
      hiddenAt = Date.now();
    } else if (hiddenAt !== null) {
      const report = Vide.Offline.apply(state, (Date.now() - hiddenAt) / 1000);
      hiddenAt = null;
      if (Vide.Offline.worthShowing(report)) Vide.Away.show(report);
    }
  });
  window.addEventListener('pagehide', save);

  // Accès depuis la console du navigateur, pratique pour déboguer.
  Vide.game = game;
  Vide.renderer = renderer;
  Vide.intro = intro;
  Vide.map = map;
  Vide.cinema = cinema;
  canvas.addEventListener('pointerdown', () => Vide.Intro.skip(intro));

  // Dispersée (ou rappelée par le Retour), la lumière éclate puis se rassemble au village : on rejoue l'éveil.
  function watchDispersal() {
    const e = game.events.find((x) => x.type === 'dispersed' || x.type === 'recall');
    if (!e) return;
    intro = Vide.Intro.create(e.type === 'recall' ? 'recall' : 'respawn', e.from);
    Vide.intro = intro;
  }

  let last = performance.now();
  let accumulator = 0;
  let sinceSave = 0;
  let sinceMenuRefresh = 0;

  function frame(now) {
    // Au retour d'un onglet en arrière-plan, on ne rattrape pas des minutes de simulation d'un coup.
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    // (L'éveil attend la fin des tableaux.)
    Vide.Cinema.update(cinema, state, dt);
    if (!Vide.Cinema.active(cinema)) Vide.Intro.update(intro, state, dt);
    renderer.introZoom = Vide.Intro.zoom(intro);
    renderer.hold = Vide.Intro.hold(intro);
    if (welcomePending && Vide.Intro.done(intro)) {
      Vide.Away.show(welcomePending);
      welcomePending = null;
    }

    if (paused() || document.hidden) {
      // Jeu en pause : on rafraîchit seulement le texte du menu.
      accumulator = 0;
      sinceMenuRefresh += dt;
      if (sinceMenuRefresh > 0.5) {
        sinceMenuRefresh = 0;
        Vide.Menu.refresh(menu);
      }
    } else {
      accumulator += dt;
      let steps = 0;
      Vide.Render.zoomBy(renderer, input.zoom);
      input.zoom = 1;
      while (accumulator >= CONFIG.step && steps < CONFIG.maxStepsPerFrame) {
        Vide.Input.update(input, game, renderer);
        Vide.Sim.step(game, CONFIG.step, input);
        accumulator -= CONFIG.step;
        steps++;
      }
      if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;
      watchDispersal();
    }

    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_EVERY) {
      sinceSave = 0;
      save();
    }

    Vide.Render.draw(renderer, game, paused() ? 0 : dt);
    const light = Vide.Render.worldToScreen(renderer, state.player.x, state.player.y);
    Vide.Intro.draw(renderer, intro, light.x, light.y);
    Vide.Audio.update(game, dt);
    Vide.Audio.readEvents(game);
    Vide.Cinema.readEvents(cinema, game);
    Vide.Away.readEvents(game);
    Vide.Cinema.draw(cinema, state);
    Vide.Away.updateToast(now);
    Vide.UI.update(ui);
    Vide.Map.update(map);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})(globalThis.Vide);
