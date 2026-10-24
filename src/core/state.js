// État persistant de la partie : tout ce qui est sauvegardé, et rien d'autre.
// Ce qui se recalcule (particules, vitesse, caméra…) vit dans l'objet « game » de sim.js.
(function (Vide) {
  'use strict';

  function create(seed) {
    return {
      seed: seed >>> 0,
      light: 0,          // lumière disponible
      totalLight: 0,     // lumière récoltée depuis le début
      upgrades: {},      // niveau de chaque amélioration, par identifiant
      player: { x: 0, y: 0 },
      territory: {
        lit: false,      // foyer allumé ?
        area: 0,         // surface du territoire (unités²)
      },
      beings: {},        // nombre d'êtres par espèce
      colonyRate: 0,     // lumière/s rapportée par la colonie (mesurée, sert pendant l'absence)
      stats: {
        playTime: 0,     // secondes de jeu actif
        collected: 0,    // particules récoltées
      },
    };
  }

  Vide.State = { create };
})(globalThis.Vide);
