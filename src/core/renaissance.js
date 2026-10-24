// Renaissance : se dissoudre dans le vide pour renaître, en échange de souvenirs (✧).
// Repart de zéro : lumière, améliorations, villages (territoires, êtres, bâtiments), échos.
// Reste : souvenirs et améliorations héritées, colosses (apaisés ou rencontrés), zones, journal, statistiques.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Catalog } = Vide;

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
    state.villages = [];
    state.roads = [];
    state.expeditions = [];
    state.echoes = 0;
    state.tides = 0;
    state.player.x = 0;
    state.player.y = 0;
    // Les souvenirs donnent un meilleur départ : le premier village fondé naîtra plus vaste (Racines),
    // avec des lueurs déjà éveillées (Éveil précoce).
    return earned;
  }

  // Remet le monde vivant en accord avec l'état après une renaissance (appelé par la simulation).
  function resetRuntime(game) {
    const { state } = game;
    game.stats = Vide.Stats.compute(state);
    game.shadows.list.length = 0;
    game.projectiles.length = 0;
    game.trade.caravans.length = 0;
    game.webs.length = 0;
    game.garden.particles.length = 0;
    game.colony.beings.length = 0;
    Vide.Colony.sync(game, true);
    game.colony.flashes.clear();
    game.colony.glows.clear();
    game.structureHp.clear();
    game.heartHurt.clear();
    game.velocity.x = game.velocity.y = 0;
    game.pulse.cooldown = 0;
    game.pulse.wave = -1;
    game.vitality.hp = game.stats.vitality;
    game.field.particles.length = 0;
    Vide.Field.fill(game.field, 0, 0, game.stats);
    Vide.Villages.refresh(game);
    game.villageCount = state.villages.length;
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
    desc: 'Te dissoudre dans le vide pour renaître plus fort. Tu perds lumière, améliorations, villages '
      + '(et leurs êtres, bâtiments, territoires) et échos ; tu gagnes des souvenirs ✧. Colosses, zones et journal restent.',
    revealed: (state) => state.renaissances > 0 || runLight(state) >= CONFIG.renaissance.threshold * 0.5,
    cost: () => ({}),
    blocked: (state) => (available(state)
      ? null
      : `encore ✦ ${util.formatNumber(CONFIG.renaissance.threshold - runLight(state))}`),
    apply: (state) => { perform(state); },
    label: (state) => (available(state) ? `+${gain(state)} ✧` : ''),
    effect: (state) => (state.renaissances ? `renaissances : ${state.renaissances}` : 'se dissoudre, renaître'),
    confirm: (state) => `Renaître ? Tu gagneras ${gain(state)} souvenir${gain(state) > 1 ? 's' : ''} ✧.\n\n`
      + 'Tu perdras ta lumière, tes améliorations, tes villages (êtres, bâtiments, territoires) et tes échos.\n'
      + 'Les colosses, les zones explorées, le journal et les souvenirs restent.',
  });

  Vide.Renaissance = { runLight, gain, available, perform, resetRuntime };
})(globalThis.Vide);
