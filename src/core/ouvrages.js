// Ouvrages des ombres : ce que bâtissent leurs bases (voir nests.js), sur leur plan radial, à mesure qu'elles
// mûrissent. Les `id` sont stockés dans les sauvegardes : ne jamais les renommer.
//   from      niveau de la base où elle bâtit le premier ; every : un de plus tous les `every` niveaux ; max
//   hp        solidité (à zéro, l'ouvrage s'effondre pour de bon)
//   ring      distance au cœur souhaitée, en part du rayon de la base ; family : 'defense' se range près des avenues
//   raid      ombres de plus dans chaque raid ; defenders : défenseurs de plus quand on frappe le cœur
//   tower     si présent : { range, damage, cooldown } — tire sur la lumière (toi, tes êtres, tes expéditions)
//   worth     stats invisibles : ce qu'en attend le gouverneur de la base (voir governors.js ; jamais affiché)
(function (Vide) {
  'use strict';

  Vide.DARK_WORKS = [
    {
      id: 'fosse',
      name: 'Fosse',
      from: 2,
      every: 2,
      max: 3,
      hp: 320,
      size: 18,
      ring: 0.45,
      family: 'fosse',
      raid: 1.5,
      defenders: 2,
      worth: { raid: 1.5, guard: 0.3 },
    },
    {
      id: 'fleche',
      name: 'Flèche',
      from: 3,
      every: 1,
      max: 5,
      hp: 260,
      size: 14,
      ring: 0.85,
      family: 'defense',
      tower: { range: 380, damage: 7, cooldown: 1.8 },
      worth: { guard: 1 },
    },
  ];

  Vide.darkWork = (type) => Vide.DARK_WORKS.find((d) => d.id === type) || null;
})(globalThis.Vide);
