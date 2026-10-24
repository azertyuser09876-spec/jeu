// Catalogue des bâtiments. Ajouter un bâtiment = ajouter une entrée ici.
//
//   id         identifiant stable (stocké dans les sauvegardes : ne jamais le renommer)
//   baseCost   prix du premier plan ; growth : multiplicateur à chaque nouveau plan du même type
//   work       travail nécessaire (secondes de bâtisseur)
//   ring       distance au foyer souhaitée, en fraction du rayon du territoire
//   size       taille à l'affichage
//   modify     (stats, n) : effet de n bâtiments achevés sur les caractéristiques
//   deposit    si présent : relais où les lueurs déposent, avec ce multiplicateur
//   hp         solidité face aux ombres (à zéro, le bâtiment s'éteint jusqu'à sa réparation)
//   tower      si présent : { range, damage, cooldown } — tire sur les ombres
//   baseEchoes si présent : prix en échos du premier plan (croissance echoGrowth)
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
      hp: 150,
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
      hp: 120,
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
      hp: 180,
      effectText: '+25 % de croissance',
      modify: (stats, n) => { stats.territoryGrowth *= 1 + 0.25 * n; },
    },
    {
      id: 'tour',
      name: 'Tour de lumière',
      desc: 'Tire des traits de lumière sur les ombres qui approchent.',
      baseCost: 5000,
      growth: 1.8,
      baseEchoes: 8,
      echoGrowth: 1.4,
      work: 70,
      ring: 0.75,
      size: 13,
      hp: 260,
      effectText: 'tire sur les ombres',
      tower: { range: 240, damage: 6, cooldown: 0.8 },
      requires: (state) => state.stats.shadows > 0,
    },
  ];
})(globalThis.Vide);
