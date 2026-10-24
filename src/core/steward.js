// Le gouverneur d'un village (l'« intendant » des premières versions) : chaque village peut garder une part de la
// lumière qu'il produit (village.steward : 0 à 50 %), mise en réserve (village.funds). Son gouverneur la dépense
// seul, avec le cerveau commun des gouverneurs (governors.js) : il veut d'abord ce qui fait vivre le village (lueurs,
// bâtisseur, logis), puis bâtit selon le plan et le type du village, lève une milice et monte des enceintes quand
// la menace monte. Il ne paie qu'en lumière (les échos restent au joueur : sa milice coûte plus cher en lumière).
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Colony, Structures, Territory, Villages, Walls, util } = Vide;

  const SHARES = [0, 0.1, 0.25, 0.5];
  const THINK = 2; // secondes entre deux décisions

  // Envie de base de chaque bâtiment (un bâtiment propre au type du village est toujours très voulu) ; elle baisse à
  // chaque exemplaire déjà là.
  const WANT = {
    prisme: 0.7, fontaine: 0.6, phare: 0.5, source: 0.45, archive: 0.35, rempart: 0.25, tour: 0.4, caserne: 0.3,
    serre: 0.8, citadelle: 0.6, fonderie: 0.75, lunette: 0.7, autel: 0.75,
  };

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

  // Ce que le gouverneur pourrait faire pour son village : [{ kind, id, cost, want, act() }].
  function wishes(state, v) {
    const l = Villages.local(state, v);
    const pop = Colony.populationIn(v);
    const builders = v.beings.batisseur || 0;
    const sites = Structures.sites(v);
    const pending = (id) => sites.some((b) => b.type === id);
    const R = Territory.radius(v);
    const danger = threat(state, v);
    const list = [];
    const being = (id, want, price) => {
      const cost = price || Colony.cost(state, Colony.species(id));
      list.push({ kind: 'being', id, cost, want, act: () => { v.beings[id] = (v.beings[id] || 0) + 1; } });
    };
    const building = (id, want) => {
      const d = Structures.def(id);
      if (Structures.crowded(v, d) || pending(id) || (d.only && d.only !== v.type && !(v.extra || []).includes(d.only))) return;
      if (d.requires && !d.requires(state)) return;
      list.push({ kind: 'building', id, cost: Structures.cost(state, d), want, act: () => Structures.plan(state, v, id) });
    };

    // Ce qui fait vivre le village.
    if (builders < 1 && builders < l.builderCap) being('batisseur', 1.3);
    if (pop < l.beingCap) being('lueur', 1);
    if (builders > 0 && R >= Structures.MIN_TERRITORY) {
      if (pop >= l.beingCap - 1) building('nid', 1.1);
      // Le reste, selon le plan et le type ; la défense d'autant plus voulue que la menace monte.
      for (const d of Vide.BUILDINGS) {
        if (!(d.id in WANT)) continue;
        const n = Structures.countIn(v, d.id, true);
        const want = (WANT[d.id] + (d.family === 'defense' ? danger * 0.6 : 0)) * Math.pow(0.75, n);
        building(d.id, want);
      }
    }
    if (builders > 0 && builders < l.builderCap && sites.length >= 2) being('batisseur', 0.8);
    // Une milice, quand la menace monte : des gardiens, payés en lumière (bien plus cher).
    const army = Colony.usedIn(v, 'armyCap');
    if (danger >= CONFIG.governors.militiaFrom && army < l.armyCap && army < CONFIG.governors.militia * (1 + danger)) {
      const sp = Colony.species('gardien');
      being('gardien', 0.5 + danger * 0.6, { light: Math.ceil(sp.baseCost * CONFIG.governors.militiaPrice) });
    }
    // Une enceinte, avec la guerre.
    const ring = builders > 0 && danger >= CONFIG.governors.wallFrom && !Walls.site(v) ? Walls.nextRing(v) : null;
    if (ring) list.push({ kind: 'wall', id: 'enceinte', cost: Walls.cost(ring), want: 0.2 + danger * 0.7, act: () => Walls.plan(v) });
    return list.filter((w) => lightOnly(w.cost));
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
    v.funds -= w.cost;
    w.act();
    return { kind: w.kind, id: w.id, cost: w.price };
  }

  const intent = (v) => intents.get(v) || null;

  // Le nom de ce qu'il vise.
  function label(goal) {
    if (goal.kind === 'being') return Colony.species(goal.id).name.toLowerCase();
    if (goal.kind === 'building') return Structures.def(goal.id).name.toLowerCase();
    return { enceinte: 'une enceinte', route: 'une route', colons: 'des colons', specialite: 'une cité' }[goal.id] || goal.id;
  }

  // Pendant le jeu : chaque village réfléchit toutes les deux secondes.
  function update(game, dt) {
    game.stewardClock = (game.stewardClock || 0) + dt;
    if (game.stewardClock < THINK) return;
    game.stewardClock = 0;
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

  Vide.Steward = { SHARES, WANT, threat, wishes, act, intent, label, update, catchUp, share };
})(globalThis.Vide);
