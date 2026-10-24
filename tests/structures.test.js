(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Stats, Territory, Villages, Structures, Catalog, Sim, Colony, Offline, Save } = Vide;
  const dt = CONFIG.step;

  function colonyState(radius, beings) {
    const state = State.create(5);
    village(state, { radius, beings });
    state.player.x = 50000; // le joueur ne gêne pas la colonie (il revient au village pour acheter)
    state.light = state.totalLight = 1e7;
    return state;
  }

  function newGame(state) {
    const game = Sim.create(state);
    game.field.particles.length = 0;
    return game;
  }

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  test('les bâtiments exigent un bâtisseur et un territoire assez grand', () => {
    const state = colonyState(300, { lueur: 1 });
    state.player.x = 0;
    assert.ok(Catalog.get('nid').revealed(state));
    assert.equal(Catalog.get('nid').blocked(state), 'il faut un bâtisseur');
    state.villages[0].beings.batisseur = 1;
    assert.equal(Catalog.get('nid').blocked(state), null);
    state.villages[0].area = Math.PI * 50 * 50;
    assert.equal(Catalog.get('nid').blocked(state), 'territoire trop petit');
  });

  test('un plan est placé sur le plan du village, à la distance voulue du cœur', () => {
    for (const d of Vide.BUILDINGS) {
      // Chaque bâtiment dans un village du type qu'il exige, le cas échéant.
      const state = State.create(5);
      village(state, { radius: 400, beings: { lueur: 4, batisseur: 1 }, type: d.only || 'jardins' });
      state.light = state.totalLight = 1e7;
      state.stats.shadows = 1; // la tour de lumière exige d'avoir déjà vaincu une ombre…
      state.echoes = 1e6;      // … et se paie aussi en échos
      assert.ok(Catalog.get(d.id).revealed(state), d.id);
      assert.ok(Catalog.buy(state, d.id), d.id);
      const b = state.villages[0].buildings[0];
      const dist = Math.hypot(b.x, b.y);
      // Sur un îlot (entre deux boulevards), le plus proche de sa place idéale.
      assert.ok(Vide.Plan.slots(state.villages[0]).some((s) => Math.hypot(s.x - b.x, s.y - b.y) < 1e-6), d.id);
      assert.ok(Math.abs(dist - d.ring * 400) <= Vide.Plan.STREET / 2 + 1e-6, `${d.id} : ${dist}`);
      assert.equal(b.work, 0);
    }
  });

  test('chaque bâtiment achevé change quelque chose', () => {
    for (const d of Vide.BUILDINGS) {
      const state = State.create(5);
      const v = village(state, { radius: 400, type: d.only || 'jardins' });
      const before = JSON.stringify([Vide.Stats.compute(state), Villages.local(state, v)]);
      v.buildings.push({ type: d.id, x: 100, y: 0, work: d.work });
      const after = JSON.stringify([Vide.Stats.compute(state), Villages.local(state, v)]);
      assert.ok(before !== after || d.tower || d.ward || d.deposit, d.id);
    }
  });

  test('un bâtiment propre à un type ne se bâtit que dans un village de ce type', () => {
    const state = State.create(5);
    village(state, { radius: 400, beings: { lueur: 4, batisseur: 1 } });
    village(state, { x: 4000, radius: 400, beings: { batisseur: 1 }, type: 'atelier' });
    state.light = state.totalLight = 1e7;
    assert.ok(Catalog.get('fonderie').revealed(state), 'un atelier existe');
    assert.equal(Catalog.get('fonderie').blocked(state), 'propre aux ateliers');
    assert.equal(Catalog.get('serre').revealed(state), true);
    state.player.x = 4000;
    assert.equal(Catalog.get('fonderie').blocked(state), null);
    assert.equal(Catalog.get('serre').blocked(state), 'propre aux jardins');
    assert.equal(Catalog.get('citadelle').revealed(state), false, 'aucun bastion');
  });

  test('une fonderie (atelier) accélère les chantiers de tous les villages', () => {
    const state = State.create(5);
    const jardins = village(state, { radius: 400 });
    const atelier = village(state, { x: 4000, radius: 400, type: 'atelier' });
    const rate = Villages.local(state, jardins).buildRate;
    atelier.buildings.push({ type: 'fonderie', x: 4100, y: 0, work: Structures.def('fonderie').work });
    assert.near(Villages.local(state, jardins).buildRate, rate * 1.25, 1e-9);
  });

  test('un rempart ralentit les ombres qui le longent', () => {
    const state = State.create(5);
    const v = village(state, { radius: 400 });
    const rempart = { type: 'rempart', x: 360, y: 0, work: Structures.def('rempart').work };
    v.buildings.push(rempart);
    assert.equal(Structures.wardAt(state, 400, 0), 0.5);
    assert.equal(Structures.wardAt(state, -400, 0), 1);
    rempart.broken = true;
    assert.equal(Structures.wardAt(state, 400, 0), 1, 'éteint, il ne retient plus rien');
  });

  test('une source rallume plus tôt les êtres éteints de son village', () => {
    const fall = (withSource) => {
      const state = State.create(5);
      const v = village(state, { radius: 300, beings: { gardien: 1 } });
      if (withSource) v.buildings.push({ type: 'source', x: 50, y: 0, work: 999 });
      state.player.x = 50000;
      const game = newGame(state);
      const g = game.colony.beings[0];
      Vide.Combat.hurtBeing(game, g, 1e6);
      let t = 0;
      while (g.down > 0 && t < 60) { Sim.step(game, dt, Sim.emptyInput()); t += dt; }
      return t;
    };
    assert.ok(fall(true) < fall(false) * 0.75);
  });

  test("l'emplacement est déterministe et s'écarte des autres bâtiments", () => {
    const a = colonyState(400, { batisseur: 1 });
    const b = colonyState(400, { batisseur: 1 });
    for (let i = 0; i < 4; i++) {
      Structures.plan(a, a.villages[0], 'nid');
      Structures.plan(b, b.villages[0], 'nid');
    }
    assert.deepEqual(a.villages[0].buildings, b.villages[0].buildings);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const d = Math.hypot(a.villages[0].buildings[i].x - a.villages[0].buildings[j].x, a.villages[0].buildings[i].y - a.villages[0].buildings[j].y);
        assert.ok(d > 50, `nids trop proches : ${d}`);
      }
    }
  });

  test('un plan coûte toujours le même prix ; ce qui limite, c’est la place et le maximum par village', () => {
    const state = colonyState(400, { lueur: 1, batisseur: 1 });
    state.player.x = 0;
    state.light = state.totalLight = 1e9;
    const v = state.villages[0];
    const first = Catalog.get('nid').cost(state).light;
    Catalog.buy(state, 'nid');
    assert.equal(Catalog.get('nid').cost(state).light, first);
    // Le maximum par village (chantiers compris).
    const phare = Structures.def('phare');
    for (let k = 0; k < phare.max; k++) assert.ok(Catalog.buy(state, 'phare'), `phare ${k}`);
    assert.equal(Catalog.get('phare').blocked(state), `${phare.max} au plus par village`);
    // La place : un emplacement par lot de surface.
    assert.equal(Structures.lots(v), 1 + Math.floor(v.area / CONFIG.villages.lotArea));
    while (v.buildings.length < Structures.lots(v)) v.buildings.push({ type: 'nid', x: 0, y: 0, work: 0 });
    v.buildings.length = Structures.lots(v);
    assert.equal(Catalog.get('fontaine').blocked(state), 'plus de place : le territoire doit grandir');
    v.area += CONFIG.villages.lotArea;
    assert.equal(Catalog.get('fontaine').blocked(state), null, 'il a grandi : de la place');
  });

  test('la caserne fait de la place à l’armée, qui a son propre plafond', () => {
    const state = colonyState(400, { lueur: 1, batisseur: 1 });
    state.player.x = 0;
    state.light = state.totalLight = 1e9;
    state.echoes = 1e6;
    state.stats.shadows = 1;
    const v = state.villages[0];
    const cap = Vide.Villages.local(state, v).armyCap;
    assert.equal(cap, CONFIG.colony.armyCap);
    for (let k = 0; k < cap; k++) assert.ok(Catalog.buy(state, 'gardien'), `gardien ${k}`);
    assert.equal(Catalog.get('etincelle').blocked(state), 'armée au complet : une caserne', 'toute l’armée partage ce plafond');
    assert.ok(Catalog.get('lueur').blocked(state) === null, 'l’armée ne prend pas de place dans la population');
    v.buildings.push({ type: 'caserne', x: 0, y: 150, work: 999 });
    assert.equal(Vide.Villages.local(state, v).armyCap, cap + 4);
  });

  test('un bâtisseur construit le chantier, qui est annoncé une fois achevé', () => {
    const state = colonyState(300, { batisseur: 1 });
    Structures.plan(state, state.villages[0], 'nid');
    const game = newGame(state);
    run(game, 5);
    assert.ok(state.villages[0].buildings[0].work > 0, 'le travail doit avoir commencé');
    assert.equal(Structures.isDone(state.villages[0].buildings[0]), false);
    run(game, Structures.def('nid').work + 10);
    assert.ok(Structures.isDone(state.villages[0].buildings[0]));
    assert.ok(game.events.some((e) => e.type === 'built' && e.building === 'nid'));
  });

  test('sans bâtisseur, un chantier reste en attente', () => {
    const state = colonyState(300, { lueur: 2 });
    Structures.plan(state, state.villages[0], 'nid');
    run(newGame(state), 20);
    assert.equal(state.villages[0].buildings[0].work, 0);
  });

  test('un nid achevé, et seulement achevé, ajoute des places', () => {
    const state = colonyState(300, {});
    const cap = Villages.local(state, state.villages[0]).beingCap;
    const nid = Structures.plan(state, state.villages[0], 'nid');
    assert.equal(Villages.local(state, state.villages[0]).beingCap, cap);
    nid.work = Structures.def('nid').work;
    assert.equal(Villages.local(state, state.villages[0]).beingCap, cap + 4);
  });

  test('un phare accélère la croissance du territoire', () => {
    const state = colonyState(300, {});
    const growth = Villages.local(state, state.villages[0]).territoryGrowth;
    Structures.plan(state, state.villages[0], 'phare').work = Structures.def('phare').work;
    assert.near(Villages.local(state, state.villages[0]).territoryGrowth, growth * 1.25, 1e-9);
  });

  test('un prisme achevé devient un relais de dépôt plus proche', () => {
    const state = colonyState(400, {});
    const prism = Structures.plan(state, state.villages[0], 'prisme');
    const near = { x: prism.x * 1.1, y: prism.y * 1.1 };
    assert.equal(Structures.nearestDeposit(state.villages[0], near.x, near.y).building, null, 'chantier : pas encore un relais');
    prism.work = Structures.def('prisme').work;
    const dep = Structures.nearestDeposit(state.villages[0], near.x, near.y);
    assert.equal(dep.building, prism);
    assert.equal(dep.mult, 1.25);
    assert.equal(Structures.nearestDeposit(state.villages[0], 1, 1).building, null, 'près du cœur, le cœur reste plus proche');
  });

  test('les lueurs ravitaillent un chantier actif et accélèrent sa construction', () => {
    const alone = colonyState(300, { batisseur: 1 });
    const helped = colonyState(300, { batisseur: 1, lueur: 6 });
    // Un chantier lourd et lointain, pour laisser le temps aux lueurs de l'alimenter.
    for (const s of [alone, helped]) Structures.plan(s, s.villages[0], 'phare');
    const ga = newGame(alone), gh = newGame(helped);
    run(ga, 30);
    run(gh, 30);
    assert.ok(helped.villages[0].buildings[0].work > alone.villages[0].buildings[0].work, `${helped.villages[0].buildings[0].work} contre ${alone.villages[0].buildings[0].work}`);
  });

  test("pendant l'absence, les bâtisseurs achèvent les chantiers dans l'ordre", () => {
    const state = colonyState(300, { batisseur: 1 });
    Structures.plan(state, state.villages[0], 'nid');
    Structures.plan(state, state.villages[0], 'phare');
    const report = Offline.apply(state, Structures.def('nid').work + 1);
    assert.deepEqual(report.built, ['nid']);
    assert.ok(Structures.isDone(state.villages[0].buildings[0]));
    assert.equal(Structures.isDone(state.villages[0].buildings[1]), false);
    assert.ok(state.villages[0].buildings[1].work > 0);
  });

  test('deux êtres oisifs qui se croisent dansent ensemble', () => {
    const state = colonyState(300, { batisseur: 2 });
    const game = newGame(state);
    const [a, b] = game.colony.beings;
    a.x = 0; a.y = 0; b.x = 20; b.y = 0;
    a.danceCooldown = b.danceCooldown = 0;
    a.danceCheck = b.danceCheck = 0;
    Sim.step(game, dt, Sim.emptyInput());
    assert.ok(a.dance && b.dance, 'les deux doivent danser');
    assert.equal(a.dance.partner, b.id);
    assert.ok(game.events.some((e) => e.type === 'dance'));
    run(game, CONFIG.colony.danceTime + 0.5);
    assert.equal(a.dance, null);
    assert.ok(a.danceCooldown > 0);
  });

  test('une sauvegarde de la 0.3 (format 3) se charge sans bâtiment', () => {
    const text = JSON.stringify({ format: 3, state: { territory: { lit: true, area: 9e4 }, beings: { lueur: 2 } } });
    const result = Save.deserialize(text);
    assert.ok(result.ok);
    assert.deepEqual(result.state.villages[0].buildings, []);
    assert.equal(result.state.villages[0].beings.lueur, 2);
  });

  test('les bâtiments sauvegardés sont nettoyés', () => {
    const state = Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, buildings: [
        { type: 'nid', x: 10, y: 20, work: 9999 },
        { type: 'temple', x: 0, y: 0, work: 1 },
        { type: 'phare', x: NaN, y: 0, work: 1 },
        { type: 'prisme', x: 5, y: 5, work: -3 },
        'nimporte',
      ] }],
    });
    assert.deepEqual(state.villages[0].buildings, [
      { type: 'nid', x: 10, y: 20, work: Structures.def('nid').work },
      { type: 'prisme', x: 5, y: 5, work: 0 },
    ]);
  });

  test('les bâtisseurs ne prennent pas de place dans la population, mais ont leur propre limite', () => {
    const state = colonyState(300, { lueur: 2, batisseur: 1 });
    state.player.x = 0;
    assert.equal(Colony.population(state), 2);
    assert.equal(Colony.total(state), 3);
    state.villages[0].beings.lueur = Villages.local(state, state.villages[0]).beingCap;
    assert.equal(Catalog.get('lueur').blocked(state), 'population pleine : un nid');
    assert.equal(Catalog.get('batisseur').blocked(state), null, 'population pleine : un bâtisseur reste possible');
    state.villages[0].beings.batisseur = Villages.local(state, state.villages[0]).builderCap;
    assert.equal(Catalog.get('batisseur').blocked(state), 'complet');
  });
})();
