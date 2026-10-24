// Menu (bouton en haut à droite ou Échap) : met le jeu en pause, rappelle les contrôles,
// montre quelques statistiques et l'état de la sauvegarde, permet de recommencer.
(function (Vide) {
  'use strict';
  const { util } = Vide;
  const $ = (id) => document.getElementById(id);

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return 'moins d’une minute';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  function create(game, hooks) {
    const menu = {
      game,
      hooks: hooks || {},
      open: false,
      button: $('menu-btn'),
      root: $('menu'),
      stats: $('menu-stats'),
      saveStatus: $('save-status'),
    };
    $('version').textContent = Vide.VERSION;
    const soundBtn = $('sound-toggle');
    const volume = $('sound-volume');
    const showSound = () => {
      soundBtn.textContent = Vide.Audio.enabled ? 'son : activé' : 'son : coupé';
      volume.value = String(Vide.Audio.volume);
    };
    soundBtn.addEventListener('click', () => {
      Vide.Audio.setEnabled(!Vide.Audio.enabled);
      showSound();
    });
    volume.addEventListener('input', () => Vide.Audio.setVolume(Number(volume.value)));
    const shakeBtn = $('shake-toggle');
    const reduced = () => Vide.Settings.get('reduceShake', Vide.Render.REDUCE_DEFAULT);
    const showOptions = () => {
      showSound();
      shakeBtn.textContent = reduced() ? 'secousses : réduites' : 'secousses : normales';
    };
    shakeBtn.addEventListener('click', () => {
      Vide.Settings.set('reduceShake', !reduced());
      showOptions();
    });
    menu.showSound = showOptions;
    setupTransfer(menu);
    menu.button.addEventListener('click', () => toggle(menu));
    $('menu-close').addEventListener('click', () => toggle(menu, false));
    $('menu-reset').addEventListener('click', () => {
      const sure = window.confirm('Tout recommencer ?\nTa lumière et tes améliorations seront perdues.');
      if (sure && menu.hooks.onReset) menu.hooks.onReset();
    });
    // Un clic à côté de la carte ferme le menu.
    menu.root.addEventListener('click', (e) => {
      if (e.target === menu.root) toggle(menu, false);
    });
    return menu;
  }

  // Exporter / importer la partie sous forme de code, pour la garder ou changer d'appareil.
  function setupTransfer(menu) {
    const area = $('transfer-code');
    const status = $('transfer-status');
    const say = (text) => { status.textContent = text; };
    $('export-btn').addEventListener('click', () => {
      area.value = Vide.Save.exportCode(menu.game.state, Date.now());
      area.select();
      const copied = navigator.clipboard && navigator.clipboard.writeText(area.value);
      if (copied) copied.then(() => say('code copié'), () => say('code prêt : copie-le'));
      else say('code prêt : copie-le');
    });
    $('import-btn').addEventListener('click', () => {
      const result = Vide.Save.importCode(area.value);
      if (!result.ok) {
        say(result.reason === 'newer' ? 'code d’une version plus récente du jeu' : 'code illisible');
        return;
      }
      const sure = window.confirm('Remplacer la partie en cours par celle de ce code ?');
      if (sure && menu.hooks.onImport) menu.hooks.onImport(result.state);
    });
  }

  function toggle(menu, open) {
    menu.open = open === undefined ? !menu.open : open;
    menu.root.hidden = !menu.open;
    menu.button.setAttribute('aria-expanded', String(menu.open));
    if (menu.open) refresh(menu);
  }

  function saveText() {
    const s = Vide.Storage;
    if (s.readOnly) return 'Une sauvegarde d’une version plus récente existe : elle n’est pas écrasée.';
    if (s.lastSave === null) return 'Pas encore sauvegardé.';
    const ago = Math.round((Date.now() - s.lastSave) / 1000);
    return `Sauvegarde automatique · il y a ${ago < 2 ? 'un instant' : ago + ' s'}`;
  }

  function refresh(menu) {
    const { state } = menu.game;
    const tamed = Vide.COLOSSI.filter((d) => state.colossi[d.id] === 'tamed').length;
    const parts = [
      `${formatDuration(state.stats.playTime)} dans le vide`,
      `${util.formatNumber(state.totalLight)} de lumière récoltée`,
      `${util.formatNumber(state.stats.collected)} particules`,
    ];
    if (state.stats.shadows) parts.push(`${util.formatNumber(state.stats.shadows)} ombres dissipées`);
    if (tamed) parts.push(`${tamed}/${Vide.COLOSSI.length} colosses apaisés`);
    if (state.renaissances) parts.push(`${state.renaissances} renaissance${state.renaissances > 1 ? 's' : ''}`);
    menu.stats.textContent = parts.join(' · ');
    menu.saveStatus.textContent = saveText();
    menu.showSound();
    // Journal : les fragments du récit déjà révélés.
    const list = $('journal-list');
    $('journal-title').textContent = `journal · ${state.lore.length}/${Vide.LORE.length}`;
    if (list.childElementCount !== state.lore.length) {
      list.textContent = '';
      for (const id of state.lore) {
        const li = document.createElement('li');
        li.textContent = Vide.Lore.get(id).text;
        list.appendChild(li);
      }
    }
  }

  Vide.Menu = { create, toggle, refresh };
})(globalThis.Vide);
