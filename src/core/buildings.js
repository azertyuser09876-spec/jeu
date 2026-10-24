// Catalogue des bâtiments. Ajouter un bâtiment = ajouter une entrée ici.
//
//   id         identifiant stable (stocké dans les sauvegardes : ne jamais le renommer)
//   baseCost   prix du premier plan ; growth : multiplicateur à chaque nouveau plan du même type
//   work       travail nécessaire (secondes de bâtisseur)
//   ring       distance au foyer souhaitée, en fraction du rayon du territoire
//   size       taille à l'affichage
//   modify     (stats, n) : effet de n bâtiments achevés sur les caractéristiques
//   deposit    si présent : relais où les lueurs déposent, avec ce multiplicateur
(function (Vide) {
  'use strict';

  Vide.BUILDINGS = [
    {
      id: 'nid',
      name: 'Nid',
      desc: 'Un abri lumineux : quatre êtres de plus peuvent vivre dans le territoire.',
      baseCost: 1500,
      growth: 1.9,
      work: 40,
      ring: 0.3,
      size: 16,
      effectText: '+4 places',
      modify: (stats, n) => { stats.beingCap += 4 * n; },
    },
    {
      id: 'prisme',
      name: 'Prisme',
      desc: 'Un relais loin du foyer : les lueurs y déposent leur charge, trajets plus courts, lumière ×1,25.',
      baseCost: 2500,
      growth: 1.8,
      work: 60,
      ring: 0.6,
      size: 15,
      effectText: 'relais · ×1,25',
      deposit: 1.25,
    },
    {
      id: 'phare',
      name: 'Phare',
      desc: 'Son faisceau pousse le territoire à grandir plus vite.',
      baseCost: 3000,
      growth: 2.1,
      work: 90,
      ring: 0.85,
      size: 14,
      effectText: '+25 % de croissance',
      modify: (stats, n) => { stats.territoryGrowth *= 1 + 0.25 * n; },
    },
  ];
})(globalThis.Vide);
