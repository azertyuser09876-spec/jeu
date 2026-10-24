// Catalogue des espèces d'êtres de lumière. Ajouter une espèce = ajouter une entrée ici
// (son comportement est choisi par `role`, voir colony.js).
//
//   id         identifiant stable (stocké dans les sauvegardes : ne jamais le renommer)
//   role       comportement : 'gatherer' (récolte), 'builder' (construit), 'guard', 'ranged', 'healer' (armée)
//   baseCost   prix du premier ; growth : multiplicateur du prix à chaque nouvel être
//   baseEchoes si présent : prix en échos du premier (même croissance echoGrowth)
//   speed      vitesse de base
//   hp         points de vie (avant améliorations)
//   damage, cooldown, range   combat (armée)
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
      hp: 20,
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
      hp: 30,
      color: [255, 196, 120],
      // Les bâtisseurs vivent au foyer et ne prennent pas de place dans la population :
      // on peut toujours en éveiller un pour bâtir des nids, même quand la population est pleine.
      cap: 'builderCap',
      requires: (state) => (state.beings.lueur || 0) > 0,
    },

    // --- Armée (débloquée par les premiers échos) ---
    {
      id: 'gardien',
      name: 'Gardien',
      desc: 'Combat les ombres au corps à corps. Robuste.',
      role: 'guard',
      army: true,
      baseCost: 3000,
      growth: 1.4,
      baseEchoes: 3,
      echoGrowth: 1.35,
      speed: 80,
      hp: 70,
      damage: 7,
      cooldown: 0.8,
      range: 16,
      color: [255, 236, 170],
      requires: (state) => state.stats.shadows > 0,
    },
    {
      id: 'etincelle',
      name: 'Étincelle',
      desc: 'Lance des traits de lumière sur les ombres, de loin. Fragile.',
      role: 'ranged',
      army: true,
      baseCost: 4500,
      growth: 1.42,
      baseEchoes: 5,
      echoGrowth: 1.35,
      speed: 75,
      hp: 28,
      damage: 4,
      cooldown: 1,
      range: 170,
      color: [150, 200, 255],
      requires: (state) => (state.beings.gardien || 0) > 0,
    },
    {
      id: 'veilleuse',
      name: 'Veilleuse',
      desc: 'Soigne les êtres blessés et ta lumière, en restant en retrait.',
      role: 'healer',
      army: true,
      baseCost: 6000,
      growth: 1.5,
      baseEchoes: 8,
      echoGrowth: 1.4,
      speed: 70,
      hp: 35,
      heal: 7,
      range: 120,
      color: [255, 170, 220],
      requires: (state) => (state.beings.gardien || 0) > 0,
    },
  ];
})(globalThis.Vide);
