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
      buildings: [],     // bâtiments : { type, x, y, work }
      colonyRate: 0,     // lumière/s rapportée par la colonie (mesurée, sert pendant l'absence)
      echoes: 0,         // échos laissés par les ombres vaincues
      tides: 0,          // marées d'ombres déjà venues (leur taille en dépend)
      army: { posture: 'garde' }, // ordre donné à l'armée : garde, escorte, chasse
      lore: [],          // fragments du récit déjà révélés, dans l'ordre
      memories: 0,       // souvenirs (✧) gagnés en renaissant
      legacy: {},        // améliorations héritées (achetées en souvenirs) : elles survivent aux renaissances
      renaissances: 0,   // nombre de renaissances
      runStart: 0,       // lumière totale au moment de la dernière renaissance
      colossi: {},       // colosses : 'heard' (entendu), 'found' (rencontré), 'tamed' (apaisé)
      zones: {
        visited: [],     // régions visitées (clés "i,j"), pour la carte
        discovered: [],  // types de zones déjà rencontrés
      },
      stats: {
        playTime: 0,     // secondes de jeu actif
        collected: 0,    // particules récoltées
        shadows: 0,      // ombres vaincues
      },
    };
  }

  Vide.State = { create };
})(globalThis.Vide);
