// Catalogue des espèces d'êtres de lumière. Ajouter une espèce = ajouter une entrée ici
// (son comportement est choisi par `role`, voir colony.js).
//
//   id         identifiant stable (stocké dans les sauvegardes : ne jamais le renommer)
//   role       comportement : 'gatherer' (récolte le jardin)…
//   baseCost   prix du premier ; growth : multiplicateur du prix à chaque nouvel être
//   speed      vitesse de base
//   color      teinte [r, g, b] pour l'affichage
//   cap        si présent : caractéristique qui limite cette espèce à part (sinon : la population, beingCap)
(function (Vide) {
  'use strict';

  Vide.SPECIES = [
    {
      id: 'lueur',
      name: 'Lueur',
      desc: 'Cherche la lumière du jardin, la porte et la dépose au foyer.',
      role: 'gatherer',
      baseCost: 250,
      growth: 1.32,
      speed: 70,
      color: [130, 255, 200],
      requires: (state) => state.territory.lit,
    },
    {
      id: 'batisseur',
      name: 'Bâtisseur',
      desc: 'Choisit un emplacement et construit les bâtiments que tu planifies.',
      role: 'builder',
      baseCost: 2000,
      growth: 1.45,
      speed: 60,
      color: [255, 196, 120],
      // Les bâtisseurs vivent au foyer et ne prennent pas de place dans la population :
      // on peut toujours en éveiller un pour bâtir des nids, même quand la population est pleine.
      cap: 'builderCap',
      requires: (state) => (state.beings.lueur || 0) > 0,
    },
  ];
})(globalThis.Vide);
