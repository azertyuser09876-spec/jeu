// Les sous-factions : en plus de son type, chaque village a la sienne, et chaque base d'ombre aussi. Elles disent
// surtout ce que fait le camp d'une créature intermédiaire à bout de forces (voir creatures.js) : l'apprivoiser,
// la purifier, la corrompre… ou l'achever.
// Le joueur choisit celle de son premier village (state.faction) ; un village fondé depuis un autre en hérite le
// plus souvent (CONFIG.factions.inherit), sinon il en prend une autre ; de même pour l'avant-poste d'une base.
// Les `id` sont stockés dans les sauvegardes : ne jamais les renommer.
//   convert   camps des créatures qu'elle retourne à bout de forces : 'wild' (la faune), 'shadow', 'light'
//   verb      ce qu'elle en fait (pour les messages) ; modify : effet sur les caractéristiques de ses villages
//   creatureDamage, creatureEchoes : contre les créatures (multiplicateurs) ; feed : ses créatures se
//   nourrissent de ce qu'elles abattent ; packs : créatures de plus (multiplicateur)
(function (Vide) {
  'use strict';
  const { CONFIG, util, Catalog } = Vide;

  Vide.FACTIONS = [
    {
      id: 'eleveurs',
      name: 'Éleveurs',
      desc: 'Sous-faction de tes villages (un choix pour toute la vie). Ils apprivoisent : une créature à bout de forces — faune du vide ou bête des ombres — rejoint leur '
        + 'village au lieu de mourir. Leurs villages logent deux êtres de plus.',
      convert: ['wild', 'shadow'],
      verb: 'apprivoisée',
      short: 'apprivoisent · 2 êtres de plus',
      tint: [190, 240, 170],
      modify: (l) => { l.beingCap += 2; },
    },
    {
      id: 'illumines',
      name: 'Illuminés',
      desc: 'Sous-faction de tes villages (un choix pour toute la vie). Ils purifient : une bête des ombres à bout de forces devient lumière, et les rejoint. Leur blanc '
        + 'avance plus vite.',
      convert: ['shadow'],
      verb: 'purifiée',
      short: 'purifient · blanc ×1,4',
      tint: [255, 245, 200],
      modify: (l) => { l.whitening *= 1.4; },
    },
    {
      id: 'lames',
      name: 'Lames',
      desc: 'Sous-faction de tes villages (un choix pour toute la vie). Elles tranchent : rien ne se convertit, tout se gagne. Bien plus fortes contre les créatures, qui '
        + 'leur laissent deux fois plus d’échos.',
      convert: [],
      verb: 'abattue',
      short: 'tranchent · ×1,5 contre les créatures',
      tint: [200, 215, 255],
      creatureDamage: 1.5,
      creatureEchoes: 2,
      modify: () => {},
    },
  ];

  Vide.DARK_FACTIONS = [
    {
      id: 'devoreurs',
      name: 'Dévoreurs',
      desc: 'Ils tuent, et s’en nourrissent : leurs bêtes reprennent des forces à chaque proie.',
      convert: [],
      verb: 'dévorée',
      tint: [200, 70, 120],
      feed: 0.25,
    },
    {
      id: 'corrupteurs',
      name: 'Corrupteurs',
      desc: 'Ils retournent : une créature de lumière à bout de forces devient ombre, et les rejoint.',
      convert: ['light'],
      verb: 'corrompue',
      tint: [120, 200, 140],
    },
    {
      id: 'meutes',
      name: 'Meutes',
      desc: 'Elles chassent en nombre : plus de bêtes, et la faune du vide à bout de forces rejoint la meute.',
      convert: ['wild'],
      verb: 'prise par la meute',
      tint: [110, 130, 240],
      packs: 1.5,
    },
  ];

  const ALL = [...Vide.FACTIONS, ...Vide.DARK_FACTIONS];

  function def(id) {
    return ALL.find((f) => f.id === id) || null;
  }

  const isLight = (id) => Vide.FACTIONS.some((f) => f.id === id);
  const isDark = (id) => Vide.DARK_FACTIONS.some((f) => f.id === id);

  // La sous-faction d'un nouveau venu né de `parent` (son id, ou null) : celle du parent le plus souvent, sinon une
  // autre de la même liste. Déterministe : tirée de (seed, numéro du nouveau venu).
  function inherit(state, parent, list, id) {
    const roll = util.hash2(id, list.length, state.seed + 4513);
    if (parent && list.some((f) => f.id === parent) && roll < CONFIG.factions.inherit) return parent;
    const others = list.filter((f) => f.id !== parent);
    return others[Math.floor(util.hash2(id, 7, state.seed + 4517) * others.length) % others.length].id;
  }

  // Le joueur choisit la sous-faction de son premier village (avant de le fonder, ou après pour une partie
  // ancienne : tous ses villages sans sous-faction la prennent).
  function choose(state, id) {
    if (!isLight(id)) return false;
    state.faction = id;
    for (const v of state.villages) if (!v.faction) v.faction = id;
    return true;
  }

  // Ce que les sous-factions changent aux caractéristiques d'un village.
  function modify(village, l) {
    const f = def(village.faction);
    if (f && f.modify) f.modify(l);
  }

  for (const f of Vide.FACTIONS) {
    Catalog.register({
      id: 'faction-' + f.id,
      tab: 'territoire',
      order: -30,
      name: f.name,
      desc: f.desc,
      // Le choix se montre quand la première fondation approche (ou d'emblée, pour une partie ancienne).
      revealed: (state) => !state.faction &&
        (state.villages.length > 0 || state.totalLight >= CONFIG.villages.firstCost * 0.4),
      cost: () => ({}),
      blocked: () => null,
      apply: (state) => { choose(state, f.id); },
      label: () => '',
      effect: () => f.short,
    });
  }

  Vide.Factions = { def, isLight, isDark, inherit, choose, modify };
})(globalThis.Vide);
