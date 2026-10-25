// Catalogue des espèces d'êtres de lumière. Ajouter une espèce = ajouter une entrée ici
// (son comportement est choisi par `role`, voir colony.js).
//
//   id         identifiant stable (stocké dans les sauvegardes : ne jamais le renommer)
//   role       comportement : 'gatherer' (récolte), 'builder' (construit), 'guard', 'ranged', 'healer' (armée)
//   baseCost   prix d'un être (fixe : recruter ne renchérit jamais ; ce qui limite, ce sont les places)
//   baseEchoes si présent : prix en échos
//   speed      vitesse de base
//   hp         points de vie (avant améliorations)
//   damage, cooldown, range   combat (armée)
//   siege      si présent : multiplicateur des dégâts contre les colosses et les cœurs des nids (troupe de siège)
//   breaker    si présent : multiplicateur des dégâts contre les ouvrages et les remparts des bases d'ombre
//   taunt      les ombres proches s'en prennent à lui d'abord ; armor : part des coups qu'il encaisse vraiment
//   color      teinte [r, g, b] pour l'affichage
//   cap        si présent : caractéristique qui limite cette espèce à part (sinon : la population, beingCap) ;
//              les espèces qui partagent un même `cap` le partagent (toute l'armée : armyCap, les casernes)
(function (Vide) {
  'use strict';

  Vide.SPECIES = [
    {
      id: 'lueur',
      name: 'Lueur',
      desc: 'Cherche la lumière du jardin de son village, la porte et la dépose en son cœur.',
      role: 'gatherer',
      baseCost: 250,
      speed: 70,
      hp: 20,
      color: [130, 255, 200],
      requires: (state) => state.villages.length > 0,
    },
    {
      id: 'batisseur',
      name: 'Bâtisseur',
      desc: 'Choisit un emplacement et construit les bâtiments que tu planifies.',
      role: 'builder',
      baseCost: 2000,
      speed: 60,
      hp: 30,
      color: [255, 196, 120],
      // Les bâtisseurs vivent au cœur du village et ne prennent pas de place dans la population :
      // on peut toujours en éveiller un pour bâtir des nids, même quand la population est pleine.
      cap: 'builderCap',
      requires: (state) => Vide.Villages.count(state, 'lueur') > 0,
    },

    // --- Armée (débloquée par les premiers échos) ---
    {
      id: 'gardien',
      name: 'Gardien',
      desc: 'Combat les ombres au corps à corps. Robuste.',
      role: 'guard',
      army: true,
      cap: 'armyCap',
      baseCost: 3000,
      worth: { guard: 0.3 }, // stats invisibles (voir governors.js) : pour la milice d'un gouverneur
      baseEchoes: 3,
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
      cap: 'armyCap',
      baseCost: 4500,
      baseEchoes: 5,
      speed: 75,
      hp: 28,
      damage: 4,
      cooldown: 1,
      range: 170,
      color: [150, 200, 255],
      requires: (state) => Vide.Villages.count(state, 'gardien') > 0,
    },
    {
      id: 'veilleuse',
      name: 'Veilleuse',
      desc: 'Soigne les êtres blessés et ta lumière, en restant en retrait.',
      role: 'healer',
      army: true,
      cap: 'armyCap',
      baseCost: 6000,
      baseEchoes: 8,
      speed: 70,
      hp: 35,
      heal: 7,
      range: 120,
      color: [255, 170, 220],
      requires: (state) => Vide.Villages.count(state, 'gardien') > 0,
    },
    {
      id: 'bouclier',
      name: 'Porte-bouclier',
      desc: 'Lent et massif : les ombres proches s’en prennent à lui d’abord, et il n’encaisse que la moitié de leurs coups.',
      role: 'guard',
      army: true,
      cap: 'armyCap',
      taunt: true,
      armor: 0.5,
      baseCost: 5000,
      baseEchoes: 6,
      speed: 58,
      hp: 170,
      damage: 3,
      cooldown: 1,
      range: 16,
      color: [210, 230, 255],
      requires: (state) => Vide.Villages.count(state, 'gardien') > 0,
    },
    // --- Troupe de siège (dès qu'un colosse ou un nid d'ombre s'est montré) ---
    {
      id: 'lancier',
      name: 'Lancier',
      desc: 'Une longue lance de lumière : il frappe de loin au corps à corps, et brise ouvrages et remparts des bases d’ombre.',
      role: 'guard',
      army: true,
      cap: 'armyCap',
      breaker: 4,
      baseCost: 8000,
      baseEchoes: 10,
      speed: 72,
      hp: 80,
      damage: 12,
      cooldown: 1.3,
      range: 36,
      color: [255, 214, 150],
      requires: (state) => Vide.Villages.count(state, 'gardien') > 0 && (state.nests.length > 0 || state.cleared.length > 0),
    },
    {
      id: 'harponneur',
      name: 'Harponneur',
      desc: 'Troupe de siège : de lourds harpons, lents, presque vains contre les ombres mais terribles contre '
        + 'les colosses et les cœurs des nids.',
      role: 'ranged',
      army: true,
      cap: 'armyCap',
      siege: 7,
      baseCost: 15000,
      baseEchoes: 25,
      speed: 55,
      hp: 50,
      damage: 4,
      cooldown: 2.4,
      range: 260,
      color: [255, 160, 120],
      requires: (state) => Vide.Villages.count(state, 'gardien') > 0
        && (Object.keys(state.colossi).length > 0 || state.nests.length > 0 || state.cleared.length > 0),
    },
  ];
})(globalThis.Vide);
