// Catalogue des améliorations. Ajouter une amélioration = ajouter une entrée ici.
//
// Chaque entrée :
//   id        identifiant stable (utilisé dans les sauvegardes : ne jamais le renommer)
//   name/desc texte affiché
//   baseCost  prix du niveau 1 ; growth : multiplicateur du prix à chaque niveau
//   max       niveau maximal, ou null si illimité
//   effects   { caractéristique: niveau => valeur } ; la valeur au niveau 0 doit être la valeur de base
//   show      caractéristiques => texte court de l'effet (affiché « actuel → suivant »)
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  Vide.UPGRADES = [
    {
      id: 'reach',
      name: 'Portée',
      desc: 'La lumière attire de plus loin.',
      baseCost: 10,
      growth: 1.55,
      max: 25,
      effects: { reach: (l) => CONFIG.attraction.radius * (1 + 0.18 * l) },
      show: (s) => String(Math.round(s.reach)),
    },
    {
      id: 'speed',
      name: 'Élan',
      desc: 'Se déplacer plus vite.',
      baseCost: 15,
      growth: 1.6,
      max: 20,
      effects: { speed: (l) => CONFIG.player.speed * (1 + 0.1 * l) },
      show: (s) => String(Math.round(s.speed)),
    },
    {
      id: 'value',
      name: 'Éclat',
      desc: 'Chaque particule rapporte plus.',
      baseCost: 30,
      growth: 1.85,
      max: null,
      effects: { value: (l) => Math.pow(1.4, l) },
      show: (s) => util.formatMultiplier(s.value),
    },
    {
      id: 'density',
      name: 'Densité',
      desc: 'Le vide se remplit de plus de lumière.',
      baseCost: 50,
      growth: 1.7,
      max: 20,
      effects: { density: (l) => 1 + 0.25 * l },
      show: (s) => util.formatMultiplier(s.density),
    },
    {
      id: 'pulse',
      name: 'Pulsation',
      desc: 'Ton onde porte plus loin et revient plus vite.',
      baseCost: 80,
      growth: 1.75,
      max: 20,
      effects: {
        pulseRadius: (l) => CONFIG.pulse.radius * (1 + 0.15 * l),
        pulseCooldown: (l) => CONFIG.pulse.cooldown * Math.pow(0.93, l),
      },
      show: (s) => `${Math.round(s.pulseRadius)} · ${s.pulseCooldown.toFixed(1).replace('.', ',')}s`,
    },
  ];
})(globalThis.Vide);
