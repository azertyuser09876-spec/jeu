// Espace de noms global du jeu. Chargé en premier.
// Le jeu n'utilise pas de modules ES pour pouvoir s'ouvrir directement depuis index.html (file://).
(function (root) {
  'use strict';
  const Vide = root.Vide = root.Vide || {};
  Vide.VERSION = '1.5.0';
})(globalThis);
