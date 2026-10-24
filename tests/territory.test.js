(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Stats, Territory, Catalog, Offline, Sim } = Vide;

  function litState() {
    const state = State.create(1);
    Territory.light(state);
    return state;
  }

  test('le foyer est éteint au départ, sans territoire', () => {
    const state = State.create(1);
    assert.equal(state.territory.lit, false);
    assert.equal(Territory.radius(state), 0);
    assert.equal(Territory.isInside(state, 0, 0), false);
  });

  test("allumer le foyer exige d'être à l'origine et d'avoir la lumière", () => {
    const state = State.create(1);
    state.light = state.totalLight = 1000;
    state.player.x = 500;
    assert.ok(Catalog.get('foyer').blocked(state));
    assert.equal(Catalog.buy(state, 'foyer'), false);
    state.player.x = 50;
    assert.ok(Catalog.buy(state, 'foyer'));
    assert.ok(state.territory.lit);
    assert.near(Territory.radius(state), CONFIG.territory.startRadius, 1e-9);
    assert.equal(state.light, 1000 - CONFIG.territory.foyerCost);
  });

  test("une fois allumé, le foyer disparaît de la boutique et le territoire s'ouvre", () => {
    const state = litState();
    state.totalLight = 1e6;
    assert.equal(Catalog.get('foyer').revealed(state), false);
    assert.ok(Catalog.tabs(state).some((t) => t.id === 'territoire'));
  });

  test('le territoire grandit, de plus en plus lentement', () => {
    const state = litState();
    const stats = Stats.compute(state);
    const r0 = Territory.radius(state);
    Territory.advance(state, stats, 600);
    const r1 = Territory.radius(state);
    Territory.advance(state, stats, 600);
    const r2 = Territory.radius(state);
    assert.ok(r1 > r0 && r2 > r1);
    assert.ok(r2 - r1 < r1 - r0, 'le deuxième gain doit être plus petit');
  });

  test("la croissance donne le même résultat en une fois ou image par image", () => {
    const a = litState(), b = litState();
    const stats = Stats.compute(a);
    const once = Territory.advance(a, stats, 60);
    let steps = 0;
    for (let i = 0; i < 3600; i++) steps += Territory.advance(b, stats, 1 / 60);
    assert.near(a.territory.area, b.territory.area, 1e-6);
    assert.near(steps, once, once * 1e-9);
  });

  test('un foyer éteint ne produit rien', () => {
    const state = State.create(1);
    assert.equal(Territory.advance(state, Stats.compute(state), 1000), 0);
  });

  test('le territoire rayonne de la lumière pendant le jeu', () => {
    const game = Sim.create(litState());
    game.field.particles.length = 0;
    for (let i = 0; i < 600; i++) Sim.step(game, CONFIG.step, Sim.emptyInput());
    assert.ok(game.state.light > 0);
    assert.equal(game.state.totalLight, game.state.light);
  });

  test("allumer le foyer émet un événement pour l'interface", () => {
    const state = State.create(1);
    const game = Sim.create(state);
    Territory.light(state);
    Sim.step(game, CONFIG.step, Sim.emptyInput());
    assert.ok(game.events.some((e) => e.type === 'foyer'));
  });

  test('la pulsation se recharge plus vite dans le territoire', () => {
    const inside = Sim.create(litState());
    const outside = Sim.create(litState());
    outside.state.player.x = 5000;
    for (const g of [inside, outside]) {
      Sim.pulse(g);
      for (let i = 0; i < 60; i++) Sim.step(g, CONFIG.step, Sim.emptyInput());
    }
    assert.ok(inside.pulse.cooldown < outside.pulse.cooldown - 0.5);
  });

  test('les améliorations du territoire apparaissent une fois le foyer allumé', () => {
    const state = State.create(1);
    state.totalLight = 1e6;
    assert.equal(Catalog.get('expansion').revealed(state), false);
    Territory.light(state);
    assert.ok(Catalog.get('expansion').revealed(state));
  });

  test("l'absence fait grandir le territoire et rapporte de la lumière", () => {
    const state = litState();
    const r0 = Territory.radius(state);
    const report = Offline.apply(state, 3600);
    assert.equal(report.applied, 3600);
    assert.equal(report.capped, false);
    assert.ok(report.light > 0 && state.light === report.light);
    assert.ok(report.radiusAfter > r0);
    assert.ok(Offline.worthShowing(report));
  });

  test("l'absence est plafonnée par la Mémoire", () => {
    const state = litState();
    const cap = Stats.compute(state).offlineCap;
    const report = Offline.apply(state, cap * 3);
    assert.equal(report.applied, cap);
    assert.ok(report.capped);
    state.upgrades.memory = 2;
    assert.equal(Stats.compute(state).offlineCap, cap + 2 * 3600);
  });

  test('une absence courte, négative ou invalide ne fait rien', () => {
    for (const seconds of [-50, NaN, Infinity * 0]) {
      const state = litState();
      const report = Offline.apply(state, seconds);
      assert.equal(report.applied, 0);
      assert.equal(state.light, 0);
    }
    assert.equal(Offline.worthShowing(Offline.apply(litState(), 30)), false);
  });

  test("sans foyer, l'absence ne rapporte rien", () => {
    const state = State.create(1);
    const report = Offline.apply(state, 3600);
    assert.equal(report.light, 0);
    assert.equal(Offline.worthShowing(report), false);
  });
})();
