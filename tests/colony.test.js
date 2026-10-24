(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Stats, Territory, Garden, Colony, Catalog, Sim, Offline, Save } = Vide;
  const dt = CONFIG.step;

  // Partie avec foyer allumé, territoire de rayon donné, champ vide autour du joueur (placé loin).
  function colonyGame(radius, lueurs) {
    const state = State.create(3);
    Territory.light(state);
    state.territory.area = Math.PI * radius * radius;
    state.beings.lueur = lueurs || 0;
    state.player.x = 50000; // le joueur ne gêne pas les lueurs
    const game = Sim.create(state);
    game.field.particles.length = 0;
    return game;
  }

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  test('sans foyer, le jardin reste vide', () => {
    const state = State.create(1);
    assert.equal(Garden.targetCount(state, Stats.compute(state)), 0);
  });

  test('le jardin naît dans le territoire, loin du foyer', () => {
    const game = colonyGame(300);
    const g = game.garden.particles;
    assert.equal(g.length, Garden.targetCount(game.state, game.stats));
    assert.ok(g.length > 10);
    for (const p of g) {
      const d = Math.hypot(p.x, p.y);
      assert.ok(d <= 300 && d >= CONFIG.garden.foyerGap, `distance ${d}`);
    }
  });

  test('une lueur s’achète une fois le foyer allumé, de plus en plus cher', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e6;
    assert.equal(Catalog.get('lueur').revealed(state), false);
    Territory.light(state);
    const first = Catalog.get('lueur').cost(state).light;
    assert.ok(Catalog.buy(state, 'lueur'));
    assert.equal(state.beings.lueur, 1);
    assert.ok(Catalog.get('lueur').cost(state).light > first);
  });

  test('la population est plafonnée', () => {
    const state = State.create(1);
    Territory.light(state);
    state.light = state.totalLight = 1e12;
    state.beings.lueur = Stats.compute(state).beingCap;
    assert.equal(Catalog.get('lueur').blocked(state), 'population pleine');
    assert.equal(Catalog.buy(state, 'lueur'), false);
  });

  test('les êtres vivants suivent les effectifs', () => {
    const game = colonyGame(200, 2);
    assert.equal(game.colony.beings.length, 2);
    game.state.beings.lueur = 4;
    Colony.sync(game);
    assert.equal(game.colony.beings.length, 4);
    game.state.beings.lueur = 1;
    Colony.sync(game);
    assert.equal(game.colony.beings.length, 1);
  });

  test("la naissance de la première lueur est annoncée", () => {
    const game = colonyGame(200, 0);
    game.state.beings.lueur = 1;
    Sim.step(game, dt, Sim.emptyInput());
    assert.ok(game.events.some((e) => e.type === 'birth' && e.first));
  });

  test('les lueurs récoltent le jardin et rapportent la lumière au foyer', () => {
    const game = colonyGame(250, 3);
    const radiation = Territory.production(game.state, game.stats);
    run(game, 40);
    const fromRadiation = radiation * 40 * 1.01; // le territoire grandit un peu pendant le test
    assert.ok(game.state.light > fromRadiation + 10, `lumière ${game.state.light}, rayonnement ~${fromRadiation}`);
    assert.ok(game.colony.rate > 0);
    assert.equal(game.state.colonyRate, game.colony.rate);
  });

  test('une lueur ne porte pas plus que sa capacité', () => {
    const game = colonyGame(250, 1);
    let max = 0;
    for (let i = 0; i < 60 * 30; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      max = Math.max(max, game.colony.beings[0].carry);
    }
    assert.ok(max > 0 && max <= game.stats.beingCapacity, `charge max ${max}`);
  });

  test('deux lueurs ne visent jamais la même particule', () => {
    const game = colonyGame(250, 6);
    for (let i = 0; i < 60 * 10; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      const targets = game.colony.beings.filter((b) => b.target).map((b) => b.target);
      assert.equal(new Set(targets).size, targets.length);
      for (const b of game.colony.beings) if (b.target) assert.equal(b.target.claimedBy, b.id);
    }
  });

  test('si le joueur prend sa cible, la lueur en choisit une autre', () => {
    const game = colonyGame(250, 1);
    run(game, 1);
    const b = game.colony.beings[0];
    const stolen = b.target;
    assert.ok(stolen, 'la lueur doit avoir une cible');
    game.state.player.x = stolen.x;
    game.state.player.y = stolen.y;
    run(game, 0.2);
    assert.ok(stolen.gone);
    run(game, 1);
    assert.ok(b.target !== stolen);
  });

  test("pendant l'absence, les êtres rapportent au rythme mesuré", () => {
    const state = State.create(1);
    Territory.light(state);
    state.beings.lueur = 2;
    state.colonyRate = 5;
    const report = Offline.apply(state, 1000);
    assert.near(report.brought, 5000, 1e-6);
    assert.ok(report.radiated > 0);
    assert.near(report.light, report.radiated + report.brought, 1e-6);
  });

  test("sans être, le rythme mémorisé ne rapporte rien", () => {
    const state = State.create(1);
    Territory.light(state);
    state.colonyRate = 5;
    assert.equal(Offline.apply(state, 1000).brought, 0);
  });

  test('une sauvegarde de la 0.2 (format 2) se charge, sans être', () => {
    const text = JSON.stringify({ format: 2, state: { light: 5, territory: { lit: true, area: 50000 } } });
    const result = Save.deserialize(text);
    assert.ok(result.ok);
    assert.deepEqual(result.state.beings, {});
    assert.equal(result.state.colonyRate, 0);
    assert.equal(result.state.territory.area, 50000);
  });

  test('les effectifs sauvegardés sont nettoyés', () => {
    const state = Save.sanitize({ beings: { lueur: 4, fantome: 3, autre: -1 }, colonyRate: -2 });
    assert.deepEqual(state.beings, { lueur: 4 });
    assert.equal(state.colonyRate, 0);
    assert.deepEqual(Save.sanitize({ beings: { lueur: 2.5 } }).beings, {});
  });
})();
