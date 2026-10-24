// L'intendant : chaque village peut garder une part de la lumière qu'il produit (village.steward : 0 à 50 %),
// mise en réserve (village.funds). Son intendant la dépense seul pour faire grandir le village, en achetant
// toujours le moins cher de ses souhaits : des lueurs tant qu'il y a de la place, un bâtisseur, des logis (nids)
// quand la population est pleine, des relais et des phares à mesure que le territoire s'étend.
// Il ne recrute pas d'armée : elle coûte des échos, qui restent au joueur.
(function (Vide) {
  'use strict';
  const { Catalog, Colony, Structures, Territory, Villages, util } = Vide;

  const SHARES = [0, 0.1, 0.25, 0.5];
  const THINK = 2; // secondes entre deux décisions

  // Ce que l'intendant voudrait faire pour son village, s'il en a les moyens : [{ kind, id, cost }].
  function wishes(state, v) {
    const l = Villages.local(state, v);
    const pop = Colony.populationIn(v);
    const builders = v.beings.batisseur || 0;
    const sites = Structures.sites(v);
    const pending = (id) => sites.some((b) => b.type === id);
    const R = Territory.radius(v);
    const list = [];
    const being = (id) => list.push({ kind: 'being', id, cost: Colony.cost(state, Colony.species(id)) });
    const building = (id) => {
      const d = Structures.def(id);
      if (!Structures.crowded(v, d)) list.push({ kind: 'building', id, cost: Structures.cost(state, d) });
    };

    if (builders < 1 && builders < l.builderCap) being('batisseur');
    if (pop < l.beingCap) being('lueur');
    if (builders > 0 && R >= Structures.MIN_TERRITORY) {
      // Logis : dès que la population touche son plafond.
      if (pop >= l.beingCap - 1 && !pending('nid')) building('nid');
      if (R >= 220 && Structures.countIn(v, 'prisme', true) < Math.floor(R / 220) && !pending('prisme')) building('prisme');
      if (R >= 300 && Structures.countIn(v, 'phare', true) < Math.floor(R / 350) && !pending('phare')) building('phare');
    }
    if (builders > 0 && builders < l.builderCap && sites.length >= 2) being('batisseur');
    // L'intendant ne paie qu'en lumière.
    return list.filter((w) => Object.keys(w.cost).every((k) => k === 'light'));
  }

  // Une décision : l'achat le moins cher que la réserve permet. Renvoie ce qui a été fait, ou null.
  function act(state, v) {
    const affordable = wishes(state, v).filter((w) => w.cost.light <= v.funds);
    if (!affordable.length) return null;
    affordable.sort((a, b) => a.cost.light - b.cost.light);
    const w = affordable[0];
    v.funds -= w.cost.light;
    if (w.kind === 'being') v.beings[w.id] = (v.beings[w.id] || 0) + 1;
    else Structures.plan(state, v, w.id);
    return w;
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
    name: 'Intendant',
    desc: 'Confie à l’intendant de ce village une part de la lumière qu’il produit : il la dépense seul pour '
      + 'le faire grandir (bâtisseur, logis, lueurs, relais, phares). Touche pour changer la part.',
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
      return v.steward || v.funds >= 1 ? `réserve ✦ ${util.formatNumber(v.funds)}` : 'part confiée';
    },
  });

  Vide.Steward = { SHARES, wishes, act, update, catchUp, share };
})(globalThis.Vide);
