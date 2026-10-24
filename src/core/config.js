// Réglages du jeu. Toutes les distances sont en unités du monde.
(function (Vide) {
  'use strict';

  Vide.CONFIG = {
    // Pas de simulation fixe : la logique avance toujours par tranches de 1/60 s.
    step: 1 / 60,
    maxStepsPerFrame: 8,

    // Le plus petit côté de l'écran montre toujours cette largeur du monde, quel que soit l'appareil.
    viewSize: 700,

    player: {
      radius: 6,
      speed: 150,        // vitesse de base (unités / s)
      acceleration: 6,   // réactivité du démarrage et du freinage
    },

    // Particules de lumière flottant dans le vide, générées autour de la lumière du joueur.
    field: {
      density: 0.00007,  // particules par unité² (avant améliorations)
      radius: 800,       // elles naissent dans ce rayon autour du joueur…
      despawnRadius: 950,// …et s'effacent au-delà de celui-ci
      maxParticles: 900, // plafond pour garder un affichage fluide
      refillTime: 6,     // secondes pour reremplir un champ entièrement vidé
      fadeIn: 1.5,       // durée d'apparition en fondu
      drift: 5,          // vitesse de dérive lente
      spawnGap: 30,      // marge hors du rayon d'attraction pour qu'aucune ne soit gratuite
      rareChance: 0.02,
      rareValue: 10,
    },

    attraction: {
      radius: 60,        // rayon d'attraction de base
      pullSpeed: 140,    // vitesse d'une particule qui vient d'être attrapée…
      pullAccel: 900,    // …puis accélération tant qu'elle n'a pas rejoint la lumière
      collectRadius: 9,
    },
  };
})(globalThis.Vide);
