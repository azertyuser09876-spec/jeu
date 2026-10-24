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
    menu.stats.textContent =
      `${formatDuration(state.stats.playTime)} dans le vide · ` +
      `${util.formatNumber(state.totalLight)} de lumière récoltée · ` +
      `${util.formatNumber(state.stats.collected)} particules`;
    menu.saveStatus.textContent = saveText();
  }

  Vide.Menu = { create, toggle, refresh };
})(globalThis.Vide);
