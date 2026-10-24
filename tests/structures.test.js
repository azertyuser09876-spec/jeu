(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Stats, Territory, Structures, Catalog, Sim, Colony, Offline, Save } = Vide;
  const dt = CONFIG.step;

  function colonyState(radius, beings) {
    const state = State.create(5);
    Territory.light(state);
    state.territory.area = Math.PI * radius * radius;
    Object.assign(state.beings, beings || {});
    state.player.x = 50000; // le joueur ne gêne pas la colonie
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
    assert.ok(Catalog.get('nid').revealed(state));
    assert.equal(Catalog.get('nid').blocked(state), 'il faut un bâtisseur');
    state.beings.batisseur = 1;
    assert.equal(Catalog.get('nid').blocked(state), null);
    state.territory.area = Math.PI * 50 * 50;
    assert.equal(Catalog.get('nid').blocked(state), 'territoire trop petit');
  });

  test('un plan est placé dans le territoire, à la distance voulue du foyer', () => {
    const state = colonyState(400, { lueur: 1, batisseur: 1 });
    for (const d of Vide.BUILDINGS) {
      assert.ok(Catalog.buy(state, d.id), d.id);
      const b = state.buildings[state.buildings.length - 1];
      const dist = Math.hypot(b.x, b.y);
      assert.near(dist, Math.max(50, d.ring * 400), 1e-6, d.id);
      assert.equal(b.work, 0);
    }
  });

  test("l'emplacement est déterministe et s'écarte des autres bâtiments", () => {
    const a = colonyState(400, { batisseur: 1 });
    const b = colonyState(400, { batisseur: 1 });
    for (let i = 0; i < 4; i++) {
      Structures.plan(a, 'nid');
      Structures.plan(b, 'nid');
    }
    assert.deepEqual(a.buildings, b.buildings);
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const d = Math.hypot(a.buildings[i].x - a.buildings[j].x, a.buildings[i].y - a.buildings[j].y);
        assert.ok(d > 50, `nids trop proches : ${d}`);
      }
    }
  });

  test('le prix monte avec chaque plan, chantiers compris', () => {
    const state = colonyState(400, { lueur: 1, batisseur: 1 });
    const first = Catalog.get('nid').cost(state).light;
    Catalog.buy(state, 'nid');
    assert.ok(Catalog.get('nid').cost(state).light > first);
  });

  test('un bâtisseur construit le chantier, qui est annoncé une fois achevé', () => {
    const state = colonyState(300, { batisseur: 1 });
    Structures.plan(state, 'nid');
    const game = newGame(state);
    run(game, 5);
    assert.ok(state.buildings[0].work > 0, 'le travail doit avoir commencé');
    assert.equal(Structures.isDone(state.buildings[0]), false);
    run(game, Structures.def('nid').work + 10);
    assert.ok(Structures.isDone(state.buildings[0]));
    assert.ok(game.events.some((e) => e.type === 'built' && e.building === 'nid'));
  });

  test('sans bâtisseur, un chantier reste en attente', () => {
    const state = colonyState(300, { lueur: 2 });
    Structures.plan(state, 'nid');
    run(newGame(state), 20);
    assert.equal(state.buildings[0].work, 0);
  });

  test('un nid achevé, et seulement achevé, ajoute des places', () => {
    const state = colonyState(300, {});
    const cap = Stats.compute(state).beingCap;
    const nid = Structures.plan(state, 'nid');
    assert.equal(Stats.compute(state).beingCap, cap);
    nid.work = Structures.def('nid').work;
    assert.equal(Stats.compute(state).beingCap, cap + 4);
  });

  test('un phare accélère la croissance du territoire', () => {
    const state = colonyState(300, {});
    const growth = Stats.compute(state).territoryGrowth;
    Structures.plan(state, 'phare').work = Structures.def('phare').work;
    assert.near(Stats.compute(state).territoryGrowth, growth * 1.25, 1e-9);
  });

  test('un prisme achevé devient un relais de dépôt plus proche', () => {
    const state = colonyState(400, {});
    const prism = Structures.plan(state, 'prisme');
    const near = { x: prism.x * 1.1, y: prism.y * 1.1 };
    assert.equal(Structures.nearestDeposit(state, near.x, near.y).building, null, 'chantier : pas encore un relais');
    prism.work = Structures.def('prisme').work;
    const dep = Structures.nearestDeposit(state, near.x, near.y);
    assert.equal(dep.building, prism);
    assert.equal(dep.mult, 1.25);
    assert.equal(Structures.nearestDeposit(state, 1, 1).building, null, 'près du foyer, le foyer reste plus proche');
  });

  test('les lueurs ravitaillent un chantier actif et accélèrent sa construction', () => {
    const alone = colonyState(300, { batisseur: 1 });
    const helped = colonyState(300, { batisseur: 1, lueur: 6 });
    // Un chantier lourd et lointain, pour laisser le temps aux lueurs de l'alimenter.
    for (const s of [alone, helped]) Structures.plan(s, 'phare');
    const ga = newGame(alone), gh = newGame(helped);
    run(ga, 30);
    run(gh, 30);
    assert.ok(helped.buildings[0].work > alone.buildings[0].work, `${helped.buildings[0].work} contre ${alone.buildings[0].work}`);
  });

  test("pendant l'absence, les bâtisseurs achèvent les chantiers dans l'ordre", () => {
    const state = colonyState(300, { batisseur: 1 });
    Structures.plan(state, 'nid');
    Structures.plan(state, 'phare');
    const report = Offline.apply(state, Structures.def('nid').work + 1);
    assert.deepEqual(report.built, ['nid']);
    assert.ok(Structures.isDone(state.buildings[0]));
    assert.equal(Structures.isDone(state.buildings[1]), false);
    assert.ok(state.buildings[1].work > 0);
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
    const text = JSON.stringify({ format: 3, state: { beings: { lueur: 2 } } });
    const result = Save.deserialize(text);
    assert.ok(result.ok);
    assert.deepEqual(result.state.buildings, []);
    assert.equal(result.state.beings.lueur, 2);
  });

  test('les bâtiments sauvegardés sont nettoyés', () => {
    const state = Save.sanitize({
      buildings: [
        { type: 'nid', x: 10, y: 20, work: 9999 },
        { type: 'temple', x: 0, y: 0, work: 1 },
        { type: 'phare', x: NaN, y: 0, work: 1 },
        { type: 'prisme', x: 5, y: 5, work: -3 },
        'nimporte',
      ],
    });
    assert.deepEqual(state.buildings, [
      { type: 'nid', x: 10, y: 20, work: Structures.def('nid').work },
      { type: 'prisme', x: 5, y: 5, work: 0 },
    ]);
  });

  test('les bâtisseurs ne prennent pas de place dans la population, mais ont leur propre limite', () => {
    const state = colonyState(300, { lueur: 2, batisseur: 1 });
    assert.equal(Colony.population(state), 2);
    assert.equal(Colony.total(state), 3);
    state.beings.lueur = Stats.compute(state).beingCap;
    assert.equal(Catalog.get('lueur').blocked(state), 'population pleine');
    assert.equal(Catalog.get('batisseur').blocked(state), null, 'population pleine : un bâtisseur reste possible');
    state.beings.batisseur = Stats.compute(state).builderCap;
    assert.equal(Catalog.get('batisseur').blocked(state), 'complet');
  });
})();
