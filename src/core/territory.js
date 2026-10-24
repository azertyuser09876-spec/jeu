// Le territoire : un disque de lumière autour du foyer (l'origine), qui grandit lentement et rayonne.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  function radius(state) {
    return Math.sqrt(state.territory.area / Math.PI);
  }

  function isInside(state, x, y) {
    if (!state.territory.lit) return false;
    return x * x + y * y <= state.territory.area / Math.PI;
  }

  function distanceToFoyer(state) {
    return Math.hypot(state.player.x, state.player.y);
  }

  function light(state) {
    const t = state.territory;
    if (t.lit) return false;
    t.lit = true;
    t.area = Math.PI * CONFIG.territory.startRadius * CONFIG.territory.startRadius;
    return true;
  }

  // Fait avancer le territoire de `seconds` secondes. Formule exacte (surface linéaire dans le temps),
  // donc identique qu'on l'appelle une fois pour 3 heures ou 648 000 fois pour 1/60 s.
  // Met à jour la surface et renvoie la lumière produite (à créditer par l'appelant).
  function advance(state, stats, seconds) {
    const t = state.territory;
    if (!t.lit || seconds <= 0) return 0;
    const a0 = t.area;
    const g = stats.territoryGrowth;
    t.area = a0 + g * seconds;
    return stats.territoryYield * (a0 * seconds + (g * seconds * seconds) / 2);
  }

  // Lumière par seconde produite actuellement.
  function production(state, stats) {
    return state.territory.lit ? state.territory.area * stats.territoryYield : 0;
  }

  Vide.Catalog.register({
    id: 'foyer',
    tab: 'territoire',
    name: 'Allumer le foyer',
    desc: 'Retourne à l’origine et allume le foyer : ton territoire naîtra et grandira, même sans toi.',
    revealed: (state) => !state.territory.lit && state.totalLight >= CONFIG.territory.foyerCost * 0.4,
    maxed: (state) => state.territory.lit,
    cost: () => ({ light: CONFIG.territory.foyerCost }),
    blocked: (state) => (distanceToFoyer(state) > CONFIG.territory.foyerReach ? 'rejoins l’origine' : null),
    apply: (state) => { light(state); },
    effect: () => 'fait naître le territoire',
  });

  Vide.Territory = { radius, isInside, distanceToFoyer, light, advance, production };
})(globalThis.Vide);
