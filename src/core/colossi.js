// Catalogue des colosses : créatures immenses qui vivent aux confins du vide.
// Ajouter un colosse = ajouter une entrée ici (et, si besoin, un corps dans BODIES de colossus.js).
//
//   id, name, epithet   identité (id stocké dans les sauvegardes : ne jamais le renommer)
//   body                forme du corps (voir BODIES dans colossus.js)
//   size                échelle du corps
//   lair                { distance, angleSeed } : repaire, à cette distance de l'origine
//   roam                rayon de flânerie autour du repaire
//   speed               vitesse de marche
//   awareness           distance à laquelle il remarque la lumière ; leash : au-delà, il renonce
//   seals               sceaux à briser dans l'ordre : { at (point du corps), hp }
//   stagger, kneel      dégâts d'armée pour le faire plier, durée à genou
//   attacks             attaques possibles (voir ATTACKS dans colossus.js)
//   fury                attaque ajoutée à chaque sceau brisé (phase 1, 2…) : il devient plus dangereux
//   requires            condition pour entendre son battement
//   reward              { text, modify(stats) } : bienfait une fois apaisé
//   tint                teinte de son corps (sauvage) ; il devient doré une fois apaisé
(function (Vide) {
  'use strict';

  Vide.COLOSSI = [
    {
      id: 'veilleur',
      name: 'Le Veilleur',
      epithet: 'gardien des confins',
      body: 'quadruped',
      size: 2.2,
      lair: { distance: 6500, angleSeed: 1 },
      roam: 600,
      speed: 34,
      awareness: 1300,
      leash: 2400,
      seals: [
        { at: 'head', hp: 180 },
        { at: 'back', hp: 240 },
        { at: 'tail', hp: 300 },
      ],
      stagger: 600,
      kneel: 7,
      attacks: ['stomp', 'breath'],
      fury: ['quake', 'sweep'],
      requires: (state) => state.stats.shadows >= 15,
      reward: {
        text: 'Il veille sur tes villages : il marche vers le danger et l’écrase de ses pas. Croissance ×2.',
        modify: (stats) => { stats.territoryGrowth *= 2; },
      },
      tint: [190, 210, 255],
      heartbeat: 'Au loin, un battement immense… Quelque chose veille aux confins. Suis la flèche dorée.',
      kneelText: 'pose un genou à terre',
    },
    {
      id: 'tisseuse',
      name: 'La Tisseuse',
      epithet: 'fileuse des courants',
      body: 'arachnid',
      size: 2,
      lair: { distance: 9500, angleSeed: 2 },
      roam: 700,
      speed: 42,
      awareness: 1400,
      leash: 2500,
      seals: [
        { at: 'head', hp: 330 },
        { at: 'back', hp: 390 },
        { at: 'abdomen', hp: 450 },
        { at: 'spinneret', hp: 510 },
      ],
      stagger: 1600,
      kneel: 6,
      attacks: ['web', 'stomp', 'web'],
      fury: ['volley', 'quake', 'volley'],
      requires: (state) => state.colossi.veilleur === 'tamed',
      reward: {
        text: 'Elle tisse tes routes en chantier, bien plus vite que tes bâtisseurs. +10 places, êtres plus rapides.',
        modify: (stats) => { stats.beingCap += 10; stats.beingSpeed *= 1.3; },
      },
      tint: [190, 255, 225],
      heartbeat: 'Au loin, un fil immense vibre… Quelque chose tisse, plus loin encore que le Veilleur.',
      kneelText: 'replie ses pattes',
    },
    {
      id: 'leviathan',
      name: 'Le Léviathan',
      epithet: 'nageur des profondeurs',
      body: 'serpent',
      size: 1.9,
      lair: { distance: 13500, angleSeed: 3 },
      roam: 1000,
      speed: 70,
      awareness: 1500,
      leash: 2800,
      seals: [
        { at: 'seg:0', hp: 480 },
        { at: 'seg:9', hp: 570 },
        { at: 'seg:18', hp: 660 },
        { at: 'seg:27', hp: 750 },
      ],
      stagger: 1400,
      kneel: 6,
      attacks: ['charge', 'breath', 'charge'],
      fury: ['quake', 'sweep', 'charge'],
      requires: (state) => state.colossi.tisseuse === 'tamed',
      reward: {
        text: 'Il porte tes expéditions, trois fois plus vite, hors d’atteinte des ombres. Échos ×2, mémoire +12 h.',
        modify: (stats) => { stats.echoGain *= 2; stats.offlineCap += 12 * 3600; },
      },
      tint: [170, 160, 255],
      heartbeat: 'Sous le vide, un chant grave… Quelque chose nage au fond du Gouffre.',
      kneelText: 'se love sur lui-même',
    },
    // --- 1.8 (corps et comportements dans beasts.js) ---
    {
      id: 'oiseau',
      name: 'L’Oiseau d’aube',
      epithet: 'qui ne touche jamais terre',
      body: 'bird',
      size: 1.9,
      lair: { distance: 8000, angleSeed: 4 },
      roam: 900,
      speed: 150,
      awareness: 1500,
      leash: 3000,
      seals: [
        { at: 'head', hp: 300 },
        { at: 'wingL', hp: 340 },
        { at: 'wingR', hp: 340 },
        { at: 'tail', hp: 400 },
      ],
      stagger: 800,
      kneel: 7,
      attacks: ['dive', 'gale'],
      fury: ['feathers', 'dive', 'feathers'],
      requires: (state) => state.colossi.veilleur === 'tamed',
      reward: {
        text: 'Il t’accompagne depuis le ciel et révèle le lointain autour de toi. Ta lumière file 15 % plus vite.',
        modify: (stats) => { stats.speed *= 1.15; },
      },
      tint: [255, 205, 175],
      heartbeat: 'Très haut, un cri clair… Quelque chose plane là où le vide pâlit, comme une aube.',
      kneelText: 'est cloué au sol',
    },
    {
      id: 'meduse',
      name: 'La Méduse',
      epithet: 'cloche des profondeurs',
      body: 'medusa',
      size: 2.1,
      lair: { distance: 12000, angleSeed: 5 },
      roam: 800,
      speed: 80,
      awareness: 1500,
      leash: 2800,
      seals: [
        { at: 'crown', hp: 600 },
        { at: 'rimL', hp: 650 },
        { at: 'rimR', hp: 650 },
        { at: 'tendril', hp: 800 },
      ],
      stagger: 5000,
      kneel: 6,
      attacks: ['lash', 'quake'],
      fury: ['volley', 'lash', 'quake'],
      requires: (state) => state.colossi.oiseau === 'tamed' && state.colossi.tisseuse === 'tamed',
      reward: {
        text: 'Elle soigne : elle flotte jusqu’au village le plus abîmé et le répare à chaque pulsation. Vitalité +30 %.',
        modify: (stats) => { stats.vitality *= 1.3; },
      },
      tint: [255, 180, 225],
      heartbeat: 'Une pulsation lente traverse le vide… comme une cloche qu’on n’entend pas.',
      kneelText: 'se replie, sans force',
    },
    {
      id: 'nuee',
      name: 'La Nuée',
      epithet: 'mille éclats d’une seule chose',
      body: 'swarm',
      size: 1.9,
      lair: { distance: 16000, angleSeed: 6 },
      roam: 900,
      speed: 85,
      awareness: 1500,
      leash: 2800,
      seals: [
        { at: 'core:0', hp: 650 },
        { at: 'core:1', hp: 730 },
        { at: 'core:2', hp: 810 },
        { at: 'core:3', hp: 900 },
      ],
      stagger: 6000,
      kneel: 6,
      attacks: ['rush', 'vortex'],
      fury: ['quake', 'rush', 'vortex'],
      requires: (state) => state.colossi.leviathan === 'tamed',
      reward: {
        text: 'Ses éclats tournent autour de toi et rabattent la lumière : portée d’attraction ×1,5.',
        modify: (stats) => { stats.reach *= 1.5; },
      },
      tint: [200, 235, 255],
      heartbeat: 'Un bruissement innombrable… Quelque chose se compte par milliers, au plus loin.',
      kneelText: 'se disperse en tous sens',
    },
    {
      id: 'dormeur',
      name: 'Le Dormeur',
      epithet: 'qui rêve le vide',
      body: 'sleeper',
      size: 3.6,
      stays: true,      // il ne quitte jamais l'endroit où il dort
      lair: { distance: 18000, angleSeed: 7 },
      roam: 0,
      speed: 0,
      awareness: 2600,
      leash: 1e9,
      seals: [
        { at: 'dream0', hp: 1500 },
        { at: 'dream1', hp: 1800 },
        { at: 'dream2', hp: 2100 },
      ],
      stagger: 1e9,
      kneel: 1,
      attacks: [],
      fury: [],
      requires: (state) => ['veilleur', 'tisseuse', 'leviathan', 'oiseau', 'meduse', 'nuee']
        .every((id) => state.colossi[id] === 'tamed'),
      reward: {
        text: 'Éveillé, il te laisse bâtir sur son dos : un village fondé sur lui grandit trois fois plus vite '
          + 'et rayonne deux fois plus.',
        modify: () => {},
        local: (state, village, stats) => {
          if (!Vide.Beasts.onBack(state, village.x, village.y)) return;
          stats.territoryGrowth *= 3;
          stats.territoryYield *= 2;
        },
      },
      tint: [215, 225, 255],
      heartbeat: 'Un souffle immense, très lent… Quelque chose dort au bout du vide, et rêve.',
      kneelText: 'soupire dans son sommeil',
    },
  ];
})(globalThis.Vide);
