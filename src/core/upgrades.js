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
      growth: 2.1,
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

    // --- Territoire (visibles une fois le foyer allumé) ---
    {
      id: 'expansion',
      tab: 'territoire',
      name: 'Expansion',
      desc: 'Le territoire s’étend plus vite.',
      requires: (state) => state.territory.lit,
      baseCost: 300,
      growth: 1.8,
      max: 20,
      effects: { territoryGrowth: (l) => CONFIG.territory.growth * (1 + 0.35 * l) },
      show: (s) => util.formatMultiplier(s.territoryGrowth / CONFIG.territory.growth),
    },
    {
      id: 'fertility',
      tab: 'territoire',
      name: 'Fertilité',
      desc: 'Chaque parcelle du territoire rayonne davantage.',
      requires: (state) => state.territory.lit,
      baseCost: 400,
      growth: 1.9,
      max: null,
      effects: { territoryYield: (l) => CONFIG.territory.yield * Math.pow(1.45, l) },
      show: (s) => util.formatMultiplier(s.territoryYield / CONFIG.territory.yield),
    },
    {
      id: 'memory',
      tab: 'territoire',
      name: 'Mémoire',
      desc: 'Le territoire se souvient plus longtemps de toi pendant ton absence.',
      requires: (state) => state.territory.lit,
      baseCost: 600,
      growth: 2.1,
      max: 20,
      effects: { offlineCap: (l) => CONFIG.territory.offlineCap + l * 3600 },
      show: (s) => `${Math.round(s.offlineCap / 3600)} h`,
    },
    {
      id: 'bloom',
      tab: 'territoire',
      name: 'Floraison',
      desc: 'Plus de lumière naît dans le territoire, pour tes lueurs.',
      requires: (state) => (state.beings.lueur || 0) > 0,
      baseCost: 800,
      growth: 1.85,
      max: 15,
      effects: { gardenDensity: (l) => 1 + 0.3 * l },
      show: (s) => util.formatMultiplier(s.gardenDensity),
    },

    // --- Êtres (visibles une fois la première lueur éveillée) ---
    {
      id: 'agility',
      tab: 'etres',
      name: 'Agilité',
      desc: 'Les êtres se déplacent plus vite.',
      requires: (state) => (state.beings.lueur || 0) > 0,
      baseCost: 500,
      growth: 1.8,
      max: 15,
      effects: { beingSpeed: (l) => 1 + 0.15 * l },
      show: (s) => util.formatMultiplier(s.beingSpeed),
    },
    {
      id: 'burden',
      tab: 'etres',
      name: 'Charge',
      desc: 'Les lueurs portent plus de lumière avant de rentrer.',
      requires: (state) => (state.beings.lueur || 0) > 0,
      baseCost: 700,
      growth: 1.9,
      max: 12,
      effects: { beingCapacity: (l) => 3 + l },
      show: (s) => String(s.beingCapacity),
    },
    {
      id: 'fervor',
      tab: 'etres',
      name: 'Ferveur',
      desc: 'La lumière rapportée par les êtres vaut plus.',
      requires: (state) => (state.beings.lueur || 0) > 0,
      baseCost: 900,
      growth: 2.3,
      max: null,
      effects: { beingValue: (l) => Math.pow(1.35, l) },
      show: (s) => util.formatMultiplier(s.beingValue),
    },
    {
      id: 'ardor',
      tab: 'etres',
      name: 'Ardeur',
      desc: 'Les bâtisseurs construisent plus vite.',
      requires: (state) => (state.beings.batisseur || 0) > 0,
      baseCost: 3000,
      growth: 1.9,
      max: 15,
      effects: { buildRate: (l) => 1 + 0.3 * l },
      show: (s) => util.formatMultiplier(s.buildRate),
    },
  ];
})(globalThis.Vide);
