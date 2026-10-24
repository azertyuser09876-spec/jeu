// Caractéristiques effectives du joueur, calculées à partir de l'état.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  function compute(state) {
    return {
      speed: CONFIG.player.speed,
      reach: CONFIG.attraction.radius,
      density: 1,   // multiplicateur de la densité du champ
      value: 1,     // multiplicateur de la lumière gagnée par particule
    };
  }

  Vide.Stats = { compute };
})(globalThis.Vide);
