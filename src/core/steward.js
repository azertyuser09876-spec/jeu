// Le gouverneur d'un village (l'« intendant » des premières versions) : chaque village peut garder une part de la
// lumière qu'il produit (village.steward : 0 à 50 %), mise en réserve (village.funds). Son gouverneur la dépense
// seul, avec le cerveau commun des gouverneurs (governors.js) : un bâtisseur d'abord, puis ce qui rend le plus de
// son prix d'après les stats invisibles de chaque chose (`worth`) et les besoins de son village (sa production
// mesurée, ce que rapporte une lueur, la menace, la place qui reste) — lueurs, logis, bâtiments, milice, enceintes ;
// ambitieux, routes, cités, colonies, campagnes. Il ne paie qu'en lumière (les échos restent au joueur : sa milice
// coûte plus cher en lumière).
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Colony, Governors, Structures, Territory, Villages, Walls, util } = Vide;

  const SHARES = [0, 0.1, 0.25, 0.5];
  const THINK = 2; // secondes entre deux décisions

  // Les stats invisibles de ses gestes propres (celles des bâtiments, des types et des êtres sont dans leurs
  // catalogues). Une route rapporte aux deux villages qu'elle relie. Une enceinte protège, mais ses lueurs n'en
  // passent que par les portes : leurs trajets s'allongent (une part de production en moins).
  const WORTH = {
    route: { yield: 0.03 },
    enceinte: { guard: 3, yield: -0.05 },
    colons: { reach: 1 },
    campagne: { guard: 2 },
  };

  // Ce que vaut une stat invisible, en part de la production du village par seconde (yield vaut la production
  // elle-même ; room et reach se comptent à part). La défense, les soins et les soldats : selon la menace.
  const VALUE = { growth: 0.5, army: 0.02, guard: 0.25, care: 0.1, away: 0.03, build: 0.1, white: 0.05 };

  // La menace qui pèse sur un village (0 à 1) : la guerre, une base d'ombre proche, les marées.
  function threat(state, v) {
    let t = Vide.War ? Vide.War.intensity(state) : 0;
    if (state.war) t = Math.max(t, CONFIG.governors.warThreat);
    const R = Territory.radius(v);
    for (const n of state.nests) {
      if (Math.hypot(n.x - v.x, n.y - v.y) - R < CONFIG.governors.baseNear) t = Math.max(t, CONFIG.governors.baseThreat);
    }
    if (state.tides > 0 && R >= CONFIG.shadows.firstTideRadius) t = Math.max(t, CONFIG.governors.tideThreat);
    return t;
  }

  const lightOnly = (cost) => Object.keys(cost).every((k) => k === 'light');

  // Les besoins de son village : ce que vaut, par seconde, un point de chaque stat invisible (voir governors.js),
  // estimé sur son état réel. `lot` : le prix caché d'un emplacement à bâtir, quand la place vient à manquer.
  function needs(state, v, l) {
    const g = CONFIG.governors;
    const rate = Math.max(v.rate || 0, g.floorRate);
    const lueurs = v.beings.lueur || 0;
    const perLueur = Math.max(lueurs ? rate / lueurs : 0, g.lueurYield);
    const danger = threat(state, v);
    const full = Colony.populationIn(v) >= l.beingCap - 1;
    const free = Structures.lots(v) - v.buildings.length;
    let total = 0;
    for (const o of state.villages) total += Math.max(o.rate || 0, g.floorRate);
    return {
      rate, perLueur, danger, total,
      lot: util.clamp(1 - free / 4, 0, 1) * rate * g.lotTime,
      yield: rate,
      growth: rate * VALUE.growth * (free <= 1 ? 2 : 1), // (plus de territoire : plus de place)
      room: perLueur * (full ? 1 : 0.2),
      army: Colony.usedIn(v, 'armyCap') >= l.armyCap ? rate * VALUE.army * danger : 0,
      guard: rate * VALUE.guard * danger,
      care: rate * VALUE.care * danger,
      away: rate * VALUE.away,
      build: rate * VALUE.build * (Structures.sites(v).length ? 1 : 0.3),
      white: rate * VALUE.white,
      reach: (total / Math.max(1, state.villages.length)) * g.colonyYield,
    };
  }

  // Ce que le gouverneur pourrait faire pour son village : [{ kind, id, cost, want, act() }].
  function wishes(state, v) {
    const l = Villages.local(state, v);
    const need = needs(state, v, l);
    const pop = Colony.populationIn(v);
    const builders = v.beings.batisseur || 0;
    const sites = Structures.sites(v);
    const pending = (id) => sites.some((b) => b.type === id);
    const R = Territory.radius(v);
    const list = [];
    const being = (id, want, price) => {
      const cost = price || Colony.cost(state, Colony.species(id));
      list.push({ kind: 'being', id, cost, want, act: () => { v.beings[id] = (v.beings[id] || 0) + 1; } });
    };
    const lueurCost = Colony.cost(state, Colony.species('lueur')).light;
    const building = (d) => {
      if (Structures.crowded(v, d) || pending(d.id) || (d.only && d.only !== v.type && !(v.extra || []).includes(d.only))) return;
      if (d.requires && !d.requires(state)) return;
      const worth = d.worth || {};
      // Chaque exemplaire de plus rapporte moins (sauf les places : quatre de plus restent quatre de plus) ; dans une
      // cité, ils se comptent par quartier.
      const linear = 'room' in worth || 'army' in worth;
      const copies = Structures.countIn(v, d.id, true) / (1 + (v.districts || []).length);
      let g = Governors.gain(worth, need) * (linear ? 1 : Math.pow(CONFIG.governors.fade, copies));
      if (d.scope === 'global') g *= need.total / need.rate; // (son effet vaut pour tous tes villages)
      const cost = Structures.cost(state, d);
      // Son vrai prix : la place qu'il prend, et les êtres qu'il faudra pour remplir un logis.
      const price = (cost.light || 0) + need.lot + (worth.room || 0) * lueurCost;
      list.push({ kind: 'building', id: d.id, cost, want: Governors.want(g, price), act: () => Structures.plan(state, v, d.id) });
    };

    // Ce qui fait vivre le village : des lueurs, des logis, puis le reste selon le plan et le type.
    if (pop < l.beingCap) being('lueur', Governors.want(need.perLueur, lueurCost));
    if (builders > 0 && R >= Structures.MIN_TERRITORY) for (const d of Vide.BUILDINGS) building(d);
    if (builders > 0 && builders < l.builderCap && sites.length >= 2) {
      being('batisseur', Governors.want(need.build * 0.5, Colony.cost(state, Colony.species('batisseur')).light));
    }
    // Une milice, quand la menace monte : des gardiens, payés en lumière (bien plus cher).
    const army = Colony.usedIn(v, 'armyCap');
    if (need.danger >= CONFIG.governors.militiaFrom && army < l.armyCap && army < CONFIG.governors.militia * (1 + need.danger)) {
      const sp = Colony.species('gardien');
      const price = Math.ceil(sp.baseCost * CONFIG.governors.militiaPrice);
      being('gardien', Governors.want(Governors.gain(sp.worth, need), price), { light: price });
    }
    // Une enceinte, avec la guerre.
    const ring = builders > 0 && need.danger >= CONFIG.governors.wallFrom && !Walls.site(v) ? Walls.nextRing(v) : null;
    if (ring) {
      const cost = Walls.cost(ring);
      // Chaque anneau protège moins que le précédent ; chacun allonge autant les trajets.
      const worth = { ...WORTH.enceinte, guard: WORTH.enceinte.guard * Math.pow(CONFIG.governors.ringFade, v.walls.length) };
      list.push({ kind: 'wall', id: 'enceinte', cost, want: Governors.want(Governors.gain(worth, need), cost.light), act: () => Walls.plan(v) });
    }
    ambitions(state, v, list, builders, need);
    // Un bâtisseur d'abord : sans lui, rien ne se bâtit.
    if (builders < 1 && builders < l.builderCap) being('batisseur', 1.2 * Math.max(1, ...list.map((w) => w.want)));
    return list.filter((w) => lightOnly(w.cost));
  }

  // Ambitieux, il agrandit le monde : une route vers le village le plus proche, une cité, des colons pour fonder,
  // une campagne contre une base proche. (Rien de tout cela tant que son ambition est faible.)
  function ambitions(state, v, list, builders, need) {
    const g = CONFIG.governors;
    const a = Governors.ambition(state.stats.playTime);
    if (a < g.ambitionFrom) return;
    // Une route (une seule en chantier à la fois).
    const to = Vide.Roads.candidate(state, v);
    const building = state.roads.some((r) => (r.a === v.id || r.b === v.id) && !Vide.Roads.isDone(state, r));
    if (to && !building && (builders > 0 || to.beings.batisseur > 0)) {
      const cost = Vide.Roads.cost(state, v, to);
      const both = need.rate + Math.max(to.rate || 0, g.floorRate);
      list.push({ kind: 'road', id: 'route', cost, want: a * Governors.want(WORTH.route.yield * both, cost.light), act: () => Vide.Roads.plan(state, v, to) });
    }
    // Une cité : la spécialité qui va avec sa sous-faction, sinon une autre.
    if (Vide.Cities.canSpecialize(v)) {
      const has = Vide.Cities.types(v);
      const t = [g.specialty[v.faction], ...Vide.VILLAGE_TYPES.map((x) => x.id)].find((id) => id && !has.includes(id));
      if (t) {
        const cost = Vide.Cities.specializeCost(v);
        const want = Governors.want(Governors.gain(Villages.type(t).worth, need), cost.light);
        list.push({ kind: 'city', id: 'specialite', cost, want, act: () => v.extra.push(t) });
      }
    }
    // Des colons, pour fonder le type de village qui manque le plus au monde (de sa sous-faction, le plus souvent) ;
    // escortés de gardiens (qui resteront là-bas) s'il peut en garder un chez lui.
    if (a >= g.colonsFrom && state.villages.length < CONFIG.villages.max && (v.beings.lueur || 0) >= CONFIG.expeditions.colonists + 2) {
      const spot = colonySpot(state, v);
      const escort = (v.beings.gardien || 0) > CONFIG.expeditions.escort;
      if (spot) {
        const cost = Vide.Expeditions.cost(state, 'colons', spot.x, spot.y, v);
        list.push({
          kind: 'colons', id: 'colons', cost, want: a * Governors.want(Governors.gain(WORTH.colons, need), cost.light),
          act: () => Vide.Expeditions.launch(state, 'colons', spot.x, spot.y, { type: colonyType(state, v), by: v, escort }),
        });
      }
    }
    // Une campagne : l'armée du village part contre la base la plus proche (sans rien coûter).
    if (!v.campaign && a >= g.campaignFrom && Colony.usedIn(v, 'armyCap') >= g.campaignArmy) {
      const nest = Vide.Nests.nearest(state, v.x, v.y, g.campaignRange);
      // (Elle ne coûte rien, mais met en jeu une part de ce que vaut l'armée.)
      let worth = 0;
      for (const sp of Vide.SPECIES) if (sp.cap === 'armyCap') worth += (v.beings[sp.id] || 0) * sp.baseCost;
      const want = a * Governors.want(Governors.gain(WORTH.campagne, need), worth * g.campaignRisk);
      if (nest) list.push({ kind: 'campaign', id: 'campagne', cost: { light: 0 }, want, act: () => { v.campaign = nest.id; } });
    }
  }

  // Le type d'un village à fonder : le moins représenté parmi tes villages (à égalité, celui de son village).
  function colonyType(state, v) {
    const count = (id) => state.villages.filter((o) => o.type === id).length;
    let best = v.type;
    for (const t of Vide.VILLAGE_TYPES) if (count(t.id) < count(best)) best = t.id;
    return best;
  }

  // Un lieu pour de nouveaux colons : à bonne distance du village, loin des autres et des bases, hors de la noirceur.
  function colonySpot(state, v) {
    const R = Territory.radius(v);
    const base = Vide.Nests.nearest(state, v.x, v.y);
    const away = base ? Math.atan2(v.y - base.y, v.x - base.x) : (v.id * 2.399) % (Math.PI * 2);
    for (let k = 0; k < 12; k++) {
      const a = away + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
      const d = R + CONFIG.villages.gap + CONFIG.governors.colonyReach;
      const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d;
      if (Vide.Nests.darkAt(state, x, y)) continue;
      if (state.nests.some((n) => Math.hypot(n.x - x, n.y - y) < CONFIG.governors.colonyClear)) continue;
      if (state.expeditions.some((e) => e.kind === 'colons' && Math.hypot(e.tx - x, e.ty - y) < CONFIG.villages.gap * 2)) continue;
      if (!Vide.Expeditions.blocked(state, 'colons', x, y, false, null, Object.assign({}, v, { funds: Infinity }))) return { x, y };
    }
    return null;
  }

  // Ce que vise chaque gouverneur (pour la fiche du village) : { id, kind, cost, saving }.
  const intents = new WeakMap();

  // Une décision : avec sa réserve, l'action la plus voulue (ou une petite dépense pendant qu'il économise).
  // Renvoie ce qui a été fait, ou null.
  function act(state, v) {
    const choice = Vide.Governors.decide(wishes(state, v).map((w) => ({ ...w, cost: w.cost.light, price: w.cost })), v.funds);
    if (!choice) {
      intents.delete(v);
      return null;
    }
    const goal = choice.saving || choice.action;
    intents.set(v, { id: goal.id, kind: goal.kind, cost: goal.cost, saving: !choice.done || Boolean(choice.saving) });
    if (!choice.done) return null;
    const w = choice.action;
    // (Un geste qui échoue — plus de place, plus de chemin — ne coûte rien.)
    const done = w.act();
    if (done === null || done === false) return null;
    v.funds -= w.cost;
    return { kind: w.kind, id: w.id, cost: w.price };
  }

  const intent = (v) => intents.get(v) || null;

  // Le nom de ce qu'il vise.
  function label(goal) {
    if (goal.kind === 'being') return Colony.species(goal.id).name.toLowerCase();
    if (goal.kind === 'building') return Structures.def(goal.id).name.toLowerCase();
    return { enceinte: 'une enceinte', route: 'une route', colons: 'des colons', specialite: 'une cité', campagne: 'une campagne' }[goal.id] || goal.id;
  }

  // Une campagne finit quand la base est tombée, ou quand l'armée du village s'est trop amenuisée.
  function campaigns(game) {
    const { state } = game;
    for (const v of state.villages) {
      if (!v.campaign) continue;
      const nest = state.nests.find((n) => n.id === v.campaign);
      if (nest && Colony.usedIn(v, 'armyCap') >= CONFIG.governors.campaignRetreat) continue;
      Vide.Sim.emit(game, 'campaignEnd', { village: v.type, won: !nest });
      v.campaign = null;
    }
  }

  // Pendant le jeu : chaque village réfléchit toutes les deux secondes.
  function update(game, dt) {
    game.stewardClock = (game.stewardClock || 0) + dt;
    if (game.stewardClock < THINK) return;
    game.stewardClock = 0;
    campaigns(game);
    for (const v of game.state.villages) {
      if (!v.funds) continue;
      const done = act(game.state, v);
      if (done) Vide.Sim.emit(game, 'steward', { village: v.type, kind: done.kind, id: done.id });
    }
  }

  // Au retour d'une absence : l'intendant a dépensé sa réserve au fil du temps. Renvoie ce qu'il a fait.
  function catchUp(state, v, max) {
    const done = [];
    for (let n = 0; n < (max || 200); n++) {
      const w = act(state, v);
      if (!w) break;
      done.push(w);
    }
    return done;
  }

  // Partage d'une lumière produite par un village : la part de l'intendant va dans sa réserve
  // (elle compte comme lumière récoltée). Renvoie ce qui revient au joueur.
  function share(state, v, amount) {
    const kept = amount * (v.steward || 0);
    if (kept > 0) {
      v.funds += kept;
      state.totalLight += kept;
    }
    return amount - kept;
  }

  Catalog.register({
    id: 'intendant',
    tab: 'village',
    group: 'êtres',
    order: -20,
    name: 'Gouverneur',
    desc: 'Confie au gouverneur de ce village une part de la lumière qu’il produit : il la dépense seul — êtres, '
      + 'logis, bâtiments selon le plan, milice et enceintes quand la menace monte ; ambitieux, il relie, fonde, '
      + 'conquiert. Touche pour changer la part.',
    revealed: (state) => Villages.count(state, 'lueur') > 0,
    cost: () => ({}),
    blocked: (state) => (Villages.current(state) ? null : 'rejoins un village'),
    apply: (state) => {
      const v = Villages.current(state);
      v.steward = SHARES[(SHARES.indexOf(v.steward) + 1) % SHARES.length];
    },
    label: (state) => {
      const v = Villages.current(state);
      return v ? `${Math.round((v.steward || 0) * 100)} %` : '';
    },
    effect: (state) => {
      const v = Villages.current(state);
      if (!v) return '';
      if (!v.steward && v.funds < 1) return 'part confiée';
      const goal = intent(v);
      const aim = goal ? ` · ${goal.saving ? 'vise' : 'fait'} : ${label(goal)}` : '';
      return `réserve ✦ ${util.formatNumber(v.funds)}${aim}`;
    },
  });

  Vide.Steward = { SHARES, WORTH, VALUE, threat, needs, wishes, ambitions, colonySpot, colonyType, act, intent, label, campaigns, update, catchUp, share };
})(globalThis.Vide);
