// Catalogue des colosses : créatures immenses qui vivent aux confins du vide.
// Ajouter un colosse = ajouter une entrée ici (et, si besoin, un corps dans BODIES de colossus.js).
//
//   id, name, epithet   identité (id stocké dans les sauvegardes : ne jamais le renommer)
//   body                forme du corps (voir BODIES dans colossus.js)
//   size                échelle du corps
//   lair                { distance, angleSeed } : repaire, à cette distance du foyer
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
    },
  ];
})(globalThis.Vide);
