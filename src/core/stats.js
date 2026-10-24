// Caractéristiques effectives du joueur, calculées à partir de l'état.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  function compute(state) {
    return {
      speed: CONFIG.player.speed,
    };
  }

  Vide.Stats = { compute };
})(globalThis.Vide);
