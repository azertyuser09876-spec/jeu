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
    onBuy: () => Vide.Audio.play('buy'),
  });
  Vide.Audio.init();
  const menu = Vide.Menu.create(game, {
    onReset: () => {
      resetting = true;
      Vide.Storage.clear();
      window.location.reload();
    },
  });
  const map = Vide.Map.create(game);
  Vide.Render.snapCamera(renderer, game);
  Vide.Away.init();
  if (welcome && Vide.Offline.worthShowing(welcome)) Vide.Away.show(welcome);

  const paused = () => menu.open || Vide.Away.open || map.open;

  // Touches d'action (en plus du déplacement). Renvoie vrai si la touche a été utilisée.
  input.onAction = (code, key) => {
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
    if (isMapKey && state.zones.visited.length > 1) {
      Vide.Map.toggle(map, true);
      return true;
    }
    const posture = { KeyG: 'garde', KeyE: 'escorte', KeyC: 'chasse' }[code];
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

  let last = performance.now();
  let accumulator = 0;
  let sinceSave = 0;
  let sinceMenuRefresh = 0;

  function frame(now) {
    // Au retour d'un onglet en arrière-plan, on ne rattrape pas des minutes de simulation d'un coup.
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;

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
      while (accumulator >= CONFIG.step && steps < CONFIG.maxStepsPerFrame) {
        Vide.Input.update(input, game, renderer);
        Vide.Sim.step(game, CONFIG.step, input);
        accumulator -= CONFIG.step;
        steps++;
      }
      if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;
    }

    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_EVERY) {
      sinceSave = 0;
      save();
    }

    Vide.Render.draw(renderer, game, paused() ? 0 : dt);
    Vide.Audio.update(game, dt);
    Vide.Audio.readEvents(game);
    Vide.Away.readEvents(game);
    Vide.Away.updateToast(now);
    Vide.UI.update(ui);
    Vide.Map.update(map);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})(globalThis.Vide);
