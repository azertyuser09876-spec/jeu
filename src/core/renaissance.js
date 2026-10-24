// Renaissance : se dissoudre dans le vide pour renaître, en échange de souvenirs (✧).
// Repart de zéro : lumière, améliorations, territoire, êtres, bâtiments, échos.
// Reste : souvenirs et améliorations héritées, colosses (apaisés ou rencontrés), zones, journal, statistiques.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Catalog, Territory } = Vide;

  // Lumière récoltée depuis la dernière renaissance.
  function runLight(state) {
    return Math.max(0, state.totalLight - state.runStart);
  }

  // Souvenirs gagnés : racine carrée de la lumière récoltée (chaque renaissance compte, sans emballement).
  function gain(state) {
    return Math.floor(Math.sqrt(runLight(state) / CONFIG.renaissance.unit));
  }

  function available(state) {
    return runLight(state) >= CONFIG.renaissance.threshold;
  }

  // Applique la renaissance à l'état (pur, testable). Renvoie les souvenirs gagnés.
  function perform(state) {
    const earned = gain(state);
    state.memories += earned;
    state.renaissances++;
    state.runStart = state.totalLight;

    state.light = 0;
    state.upgrades = {};
    state.beings = {};
    state.buildings = [];
    state.echoes = 0;
    state.colonyRate = 0;
    state.tides = 0;
    state.player.x = 0;
    state.player.y = 0;
    state.territory = { lit: false, area: 0 };

    // Les souvenirs donnent un meilleur départ.
    const stats = Vide.Stats.compute(state);
    if ((state.legacy.roots || 0) > 0 || stats.startLueurs > 0) Territory.light(state);
    if (stats.startLueurs > 0) state.beings.lueur = stats.startLueurs;
    return earned;
  }

  // Remet le monde vivant en accord avec l'état après une renaissance (appelé par la simulation).
  function resetRuntime(game) {
    const { state } = game;
    game.stats = Vide.Stats.compute(state);
    game.shadows.list.length = 0;
    game.projectiles.length = 0;
    game.webs.length = 0;
    game.garden.particles.length = 0;
    game.colony.beings.length = 0;
    Vide.Colony.sync(game, true);
    game.colony.flashes.clear();
    game.structureHp.clear();
    game.velocity.x = game.velocity.y = 0;
    game.pulse.cooldown = 0;
    game.pulse.wave = -1;
    game.vitality.hp = game.stats.vitality;
    game.field.particles.length = 0;
    Vide.Field.fill(game.field, 0, 0, game.stats);
    Vide.Garden.fill(game.garden, state, game.stats);
    game.lit = state.territory.lit;
    game.rate = 0;
    // Un colosse en plein combat renonce et retourne à son repaire.
    for (const c of game.colossi) {
      if (c.mode === 'hunt' || c.mode === 'kneel') {
        c.mode = 'roam';
        c.attack = null;
      }
    }
  }

  Catalog.register({
    id: 'renaissance',
    tab: 'souvenirs',
    order: -20,
    name: 'Renaissance',
    desc: 'Te dissoudre dans le vide pour renaître plus fort. Tu perds lumière, améliorations, territoire, '
      + 'êtres, bâtiments et échos ; tu gagnes des souvenirs ✧. Colosses, zones et journal restent.',
    revealed: (state) => state.renaissances > 0 || runLight(state) >= CONFIG.renaissance.threshold * 0.5,
    cost: () => ({}),
    blocked: (state) => (available(state)
      ? null
      : `encore ✦ ${util.formatNumber(CONFIG.renaissance.threshold - runLight(state))}`),
    apply: (state) => { perform(state); },
    label: (state) => (available(state) ? `+${gain(state)} ✧` : ''),
    effect: (state) => (state.renaissances ? `renaissances : ${state.renaissances}` : 'se dissoudre, renaître'),
    confirm: (state) => `Renaître ? Tu gagneras ${gain(state)} souvenir${gain(state) > 1 ? 's' : ''} ✧.\n\n`
      + 'Tu perdras ta lumière, tes améliorations, ton territoire, tes êtres, tes bâtiments et tes échos.\n'
      + 'Les colosses, les zones explorées, le journal et les souvenirs restent.',
  });

  Vide.Renaissance = { runLight, gain, available, perform, resetRuntime };
})(globalThis.Vide);
