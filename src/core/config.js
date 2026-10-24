// Réglages du jeu. Toutes les distances sont en unités du monde.
(function (Vide) {
  'use strict';

  Vide.CONFIG = {
    // Pas de simulation fixe : la logique avance toujours par tranches de 1/60 s.
    step: 1 / 60,
    maxStepsPerFrame: 8,

    // Le plus petit côté de l'écran montre toujours cette largeur du monde, quel que soit l'appareil.
    viewSize: 700,
  };
})(globalThis.Vide);
