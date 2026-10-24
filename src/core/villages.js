// Les villages. Il n'y a plus de foyer central : le joueur fonde ses villages là où il se trouve, d'un type
// qu'il choisit ; chacun a son cœur, son territoire, ses êtres, ses bâtiments et son jardin.
// L'origine (0, 0) n'est plus que le lieu où naît la lumière.
//
// Un village (état persistant, dans state.villages) :
//   id         numéro stable dans la partie
//   type       identifiant de VILLAGE_TYPES (stocké dans les sauvegardes : ne jamais le renommer)
//   x, y       position du cœur
//   area       surface du territoire (unités²)
//   cells      forme du territoire : [i, j, blanc, …] (voir territory.js)
//   beings     nombre d'êtres par espèce
//   buildings  bâtiments : { type, x, y, work, broken? }
//   rate       lumière/s rapportée par ses êtres (mesurée, sert pendant l'absence)
//   steward    part de la lumière produite confiée à son intendant (0 à 0,5), funds : sa réserve
//   stock      ressources du village : { matiere, savoir } (voir trade.js)
//   extra      spécialités en plus de son type (une cité), districts : anciens cœurs devenus quartiers
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Territory } = Vide;

  // Types de villages, au choix du joueur. Ajouter un type = ajouter une entrée.
  //   modify(local)  effet sur les caractéristiques du village (voir local())
  //   tint           teinte du territoire et du cœur
  //   shape          silhouette du territoire (voir Territory.grow) :
  //                    metric  'round' (disque), 'square' (carré), 'octagon' (octogone)
  //                    lobes   nombre de lobes ou de rayons ; depth : leur ampleur ; sharp : leur finesse
  //                    noise   part de l'irrégularité habituelle
  Vide.VILLAGE_TYPES = [
    {
      id: 'jardins',
      name: 'Jardins',
      desc: 'Fonder ici des jardins : la lumière y naît plus dense, et les lueurs portent davantage.',
      effectText: 'jardin ×1,4',
      tint: [150, 255, 205],
      shape: { metric: 'round', lobes: 5, depth: 0.22, sharp: 1, noise: 0.8 },
      modify: (l) => { l.gardenDensity *= 1.4; l.beingCapacity += 1; },
    },
    {
      id: 'bastion',
      name: 'Bastion',
      desc: 'Fonder ici un bastion : remparts solides, territoire qui brûle les ombres deux fois plus, armée plus '
        + 'nombreuse et plus forte.',
      effectText: 'armée +4 · ×1,25',
      tint: [255, 222, 150],
      shape: { metric: 'octagon', lobes: 0, depth: 0, sharp: 1, noise: 0.35 },
      modify: (l) => { l.structureArmor *= 1.6; l.burn *= 2; l.armyDamage *= 1.25; l.armyCap += 4; },
    },
    {
      id: 'atelier',
      name: 'Atelier',
      desc: 'Fonder ici un atelier : on y bâtit bien plus vite, et un bâtisseur de plus peut y vivre.',
      effectText: 'chantiers ×1,6',
      tint: [255, 186, 130],
      shape: { metric: 'square', lobes: 0, depth: 0, sharp: 1, noise: 0.5 },
      modify: (l) => { l.buildRate *= 1.6; l.builderCap += 1; },
    },
    {
      id: 'observatoire',
      name: 'Observatoire',
      desc: 'Fonder ici un observatoire, tourné vers le loin : son territoire grandit plus vite, '
        + 'et ta pulsation s’y recharge encore plus vite.',
      effectText: 'croissance ×1,35',
      tint: [165, 195, 255],
      shape: { metric: 'round', lobes: 4, depth: 0.32, sharp: 4, noise: 0.7 },
      modify: (l) => { l.territoryGrowth *= 1.35; l.pulseBoost *= 1.5; },
    },
    {
      id: 'sanctuaire',
      name: 'Sanctuaire',
      desc: 'Fonder ici un sanctuaire : ta lumière et les êtres s’y soignent deux fois plus vite, '
        + 'ses êtres sont plus résistants, et son cœur blanchit plus vite.',
      effectText: 'soins ×2',
      tint: [255, 205, 238],
      shape: { metric: 'round', lobes: 0, depth: 0, sharp: 1, noise: 0.35 },
      modify: (l) => { l.regen *= 2; l.beingHp *= 1.3; l.whitening *= 1.6; },
    },
  ];

  function type(id) {
    const t = Vide.VILLAGE_TYPES.find((v) => v.id === id);
    if (!t) throw new Error(`Type de village inconnu : ${id}`);
    return t;
  }

  function byId(state, id) {
    return state.villages.find((v) => v.id === id) || null;
  }

  // Village dont le territoire contient (x, y), à `margin` près ; le cœur le plus proche s'il y en a plusieurs.
  function at(state, x, y, margin) {
    let best = null;
    let bestD = Infinity;
    for (const v of state.villages) {
      if (!Territory.contains(v, x, y, margin)) continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // Village où se trouve le joueur (la boutique des êtres et des bâtiments s'y applique), ou null.
  function current(state) {
    return at(state, state.player.x, state.player.y, CONFIG.villages.reach);
  }

  // Village dont le cœur est le plus proche de (x, y), ou null s'il n'y en a aucun.
  function nearest(state, x, y) {
    let best = null;
    let bestD = Infinity;
    for (const v of state.villages) {
      const d = Math.hypot(v.x - x, v.y - y);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // Le plus grand village (les colosses apaisés y font leur ronde), ou null.
  function main(state) {
    let best = null;
    for (const v of state.villages) if (!best || v.area > best.area) best = v;
    return best;
  }

  // Nombre d'êtres d'une espèce, tous villages confondus.
  function count(state, speciesId) {
    let n = 0;
    for (const v of state.villages) n += v.beings[speciesId] || 0;
    return n;
  }

  // --- Caractéristiques locales ---

  // Celles du joueur (améliorations, souvenirs, colosses), puis les bâtiments du village, puis son type.
  // Clés propres aux villages : structureArmor (les coups sur ses bâtiments sont divisés d'autant),
  // burn (brûlure des ombres dans son territoire), pulseBoost (recharge de la pulsation), regen (soins),
  // whitening (vitesse du blanc), rekindle (vitesse à laquelle ses êtres éteints se rallument),
  // gardenRare (fréquence de la lumière dorée dans son jardin).
  function local(state, village, stats) {
    const l = {
      ...(stats || Vide.Stats.compute(state)),
      structureArmor: 1, burn: 1, pulseBoost: 1, regen: 1, whitening: 1, rekindle: 1, gardenRare: 1,
    };
    // Une cité vaut au moins ses villages : chaque quartier (ancien village) garde sa croissance, ses places
    // et son jardin.
    const districts = (village.districts || []).length;
    l.gardenMax = CONFIG.garden.max * (1 + districts);
    if (districts) {
      l.territoryGrowth *= 1 + districts;
      l.beingCap += CONFIG.colony.cap * districts;
      l.builderCap += Vide.Stats.base().builderCap * districts;
      l.armyCap += CONFIG.colony.armyCap * districts;
    }
    Vide.Structures.modify(village, l);
    type(village.type).modify(l);
    if (Vide.Factions) Vide.Factions.modify(village, l);
    for (const t of village.extra || []) type(t).modify(l); // une cité cumule ses spécialités
    if (Vide.Trade && village.stock) Vide.Trade.modify(village, l);
    if (Vide.Colossus) Vide.Colossus.modifyLocal(state, village, l); // (un village bâti sur le Dormeur)
    return l;
  }

  // Recalcule les caractéristiques de chaque village (à chaque pas de simulation).
  function refresh(game) {
    const map = game.villageStats;
    map.clear();
    for (const v of game.state.villages) map.set(v, local(game.state, v, game.stats));
  }

  function statsOf(game, village) {
    return game.villageStats.get(village) || local(game.state, village, game.stats);
  }

  // --- Fondation ---

  function foundCost(state) {
    const c = CONFIG.villages;
    // Les villages absorbés par une cité (ses quartiers) comptent toujours : fusionner ne rend pas la
    // fondation suivante moins chère.
    let n = 0;
    for (const v of state.villages) n += 1 + (v.districts ? v.districts.length : 0);
    // Les colons en route comptent aussi : on ne lance pas dix fondations au même prix.
    for (const e of state.expeditions || []) if (e.kind === 'colons') n++;
    return n === 0 ? c.firstCost : Math.ceil(c.cost * Math.pow(c.growth, n - 1));
  }

  // Raison qui empêche de fonder un village là où se trouve le joueur, ou null.
  function foundBlocked(state) {
    const { x, y } = state.player;
    if (state.villages.length >= CONFIG.villages.max) return 'assez de villages';
    for (const v of state.villages) {
      const d = Math.hypot(v.x - x, v.y - y) - Territory.radius(v);
      if (d < 0) return 'hors des villages';
      if (d < CONFIG.villages.gap) return 'trop près d’un village';
    }
    return null;
  }

  // Fonde un village du type donné à l'emplacement du joueur (ou en `at`, pour des colons). Le premier d'une vie
  // reçoit les lueurs offertes par les souvenirs (Éveil précoce). Sa sous-faction : celle que le joueur a choisie ;
  // né d'un autre village (`from` : des colons), il en hérite le plus souvent, ou mute.
  function found(state, typeId, at, from) {
    const stats = Vide.Stats.compute(state);
    const where = at || state.player;
    const parent = from || null;
    const village = {
      id: state.villages.reduce((m, v) => Math.max(m, v.id), 0) + 1,
      type: type(typeId).id,
      x: where.x,
      y: where.y,
      area: Math.PI * stats.startRadius ** 2,
      cells: [],
      beings: {},
      buildings: [],
      rate: 0,
      steward: 0,
      funds: 0,
      stock: { matiere: 0, savoir: 0 },
      extra: [],
      districts: [],
      walls: [],
      faction: null,
      creatures: {},
    };
    village.faction = parent && parent.faction
      ? Vide.Factions.inherit(state, parent.faction, Vide.FACTIONS, village.id) : state.faction;
    Territory.grow(village);
    if (state.villages.length === 0 && stats.startLueurs > 0) village.beings.lueur = stats.startLueurs;
    state.villages.push(village);
    return village;
  }

  for (const t of Vide.VILLAGE_TYPES) {
    Catalog.register({
      id: 'village-' + t.id,
      tab: 'fonder',
      composed: true, // l'interface le propose dans le compositeur de fondation, pas en liste
      name: t.name,
      desc: t.desc,
      // Les fondations ne se montrent que hors des villages : dans un village, la boutique est la sienne.
      revealed: (state) => !current(state) &&
        state.totalLight >= (state.villages.length ? foundCost(state) * 0.25 : CONFIG.villages.firstCost * 0.4),
      cost: (state) => ({ light: foundCost(state) }),
      blocked: (state) => (state.faction ? foundBlocked(state) : 'choisis ta sous-faction'),
      apply: (state) => { found(state, t.id); },
      label: (state) => {
        const n = state.villages.filter((v) => v.type === t.id).length;
        return n ? `×${n}` : '';
      },
      effect: () => t.effectText,
    });
  }

  Vide.Villages = {
    type, byId, at, current, nearest, main, count, local, refresh, statsOf, foundCost, foundBlocked, found,
  };
})(globalThis.Vide);
