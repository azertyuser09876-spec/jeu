// Aides partagées par les tests.
(function (root) {
  'use strict';

  // Fonde un village (des jardins par défaut) au point voulu, avec un rayon et des effectifs donnés.
  // Le joueur reste où il était. Renvoie le village.
  root.VideTest.village = function (state, opts) {
    const o = opts || {};
    const px = state.player.x, py = state.player.y;
    state.player.x = o.x || 0;
    state.player.y = o.y || 0;
    const village = root.Vide.Villages.found(state, o.type || 'jardins');
    state.player.x = px;
    state.player.y = py;
    if (o.radius) {
      village.area = Math.PI * o.radius * o.radius;
      village.cells = [];
      root.Vide.Territory.grow(village);
    }
    Object.assign(village.beings, o.beings || {});
    return village;
  };
})(globalThis);
