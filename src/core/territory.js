// Le territoire de chaque village : une étendue de lumière autour de son cœur, qui grandit lentement et rayonne.
(function (Vide) {
  'use strict';

  function radius(village) {
    return village ? Math.sqrt(village.area / Math.PI) : 0;
  }

  function contains(village, x, y, margin) {
    const r = radius(village) + (margin || 0);
    return (x - village.x) ** 2 + (y - village.y) ** 2 <= r * r;
  }

  // Le point (x, y) est-il dans le territoire d'un village ?
  function isInside(state, x, y) {
    return state.villages.some((v) => contains(v, x, y));
  }

  // Distance de (x, y) au bord du territoire le plus proche (négative à l'intérieur), Infinity sans village.
  function distanceToEdge(state, x, y) {
    let best = Infinity;
    for (const v of state.villages) best = Math.min(best, Math.hypot(v.x - x, v.y - y) - radius(v));
    return best;
  }

  // Fait avancer le territoire d'un village de `seconds` secondes. Formule exacte (surface linéaire dans le temps),
  // donc identique qu'on l'appelle une fois pour 3 heures ou 648 000 fois pour 1/60 s.
  // Met à jour la surface et renvoie la lumière produite (à créditer par l'appelant).
  // `stats` : caractéristiques du village (voir Villages.local).
  function advance(village, stats, seconds) {
    if (seconds <= 0) return 0;
    const a0 = village.area;
    const g = stats.territoryGrowth;
    village.area = a0 + g * seconds;
    return stats.territoryYield * (a0 * seconds + (g * seconds * seconds) / 2);
  }

  // Lumière par seconde produite actuellement par un village.
  function production(village, stats) {
    return village.area * stats.territoryYield;
  }

  Vide.Territory = { radius, contains, isInside, distanceToEdge, advance, production };
})(globalThis.Vide);
