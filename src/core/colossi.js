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
      stagger: 1000,
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
  ];
})(globalThis.Vide);
