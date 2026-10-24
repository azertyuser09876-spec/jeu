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
      size: 1.3,
      lair: { distance: 6500, angleSeed: 1 },
      roam: 500,
      speed: 26,
      awareness: 950,
      leash: 1800,
      seals: [
        { at: 'head', hp: 120 },
        { at: 'back', hp: 160 },
        { at: 'tail', hp: 200 },
      ],
      stagger: 420,
      kneel: 7,
      attacks: ['stomp', 'breath'],
      requires: (state) => state.stats.shadows >= 15,
      reward: {
        text: 'Il veille sur ton territoire : croissance ×2, et ses pas écrasent les ombres.',
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
      size: 1.15,
      lair: { distance: 9500, angleSeed: 2 },
      roam: 600,
      speed: 34,
      awareness: 1000,
      leash: 1900,
      seals: [
        { at: 'head', hp: 220 },
        { at: 'back', hp: 260 },
        { at: 'abdomen', hp: 300 },
        { at: 'spinneret', hp: 340 },
      ],
      stagger: 700,
      kneel: 6,
      attacks: ['web', 'stomp', 'web'],
      requires: (state) => state.colossi.veilleur === 'tamed',
      reward: {
        text: 'Elle relie tes êtres entre eux : +10 places et des êtres plus rapides.',
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
      size: 1.25,
      lair: { distance: 13500, angleSeed: 3 },
      roam: 900,
      speed: 60,
      awareness: 1100,
      leash: 2200,
      seals: [
        { at: 'seg:0', hp: 320 },
        { at: 'seg:9', hp: 380 },
        { at: 'seg:18', hp: 440 },
        { at: 'seg:27', hp: 500 },
      ],
      stagger: 1000,
      kneel: 6,
      attacks: ['charge', 'breath', 'charge'],
      requires: (state) => state.colossi.tisseuse === 'tamed',
      reward: {
        text: 'Il plonge pour toi dans les profondeurs : échos ×2, et ta mémoire porte 12 h de plus.',
        modify: (stats) => { stats.echoGain *= 2; stats.offlineCap += 12 * 3600; },
      },
      tint: [170, 160, 255],
      heartbeat: 'Sous le vide, un chant grave… Quelque chose nage au fond du Gouffre.',
      kneelText: 'se love sur lui-même',
    },
  ];
})(globalThis.Vide);
