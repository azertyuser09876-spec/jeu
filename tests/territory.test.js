(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Stats, Territory, Villages, Catalog, Offline, Sim } = Vide;

  // Partie avec un village de jardins à l'origine.
  function withVillage() {
    const state = State.create(1);
    village(state);
    return state;
  }

  test('au départ, aucun village ni territoire', () => {
    const state = State.create(1);
    assert.deepEqual(state.villages, []);
    assert.equal(Territory.isInside(state, 0, 0), false);
    assert.equal(Territory.distanceToEdge(state, 0, 0), Infinity);
  });

  test('un village fondé a un territoire de départ autour de son cœur', () => {
    const state = State.create(1);
    const v = village(state, { x: 900, y: -300 });
    assert.near(Territory.radius(v), CONFIG.territory.startRadius, 1e-9);
    assert.ok(Territory.isInside(state, 900, -300));
    assert.equal(Territory.isInside(state, 0, 0), false);
    assert.near(Territory.distanceToEdge(state, 900, -100), 200 - CONFIG.territory.startRadius, 1e-9);
  });

  test('le territoire grandit, de plus en plus lentement', () => {
    const state = withVillage();
    const v = state.villages[0];
    const stats = Villages.local(state, v);
    const r0 = Territory.radius(v);
    Territory.advance(v, stats, 600);
    const r1 = Territory.radius(v);
    Territory.advance(v, stats, 600);
    const r2 = Territory.radius(v);
    assert.ok(r1 > r0 && r2 > r1);
    assert.ok(r2 - r1 < r1 - r0, 'le deuxième gain doit être plus petit');
  });

  test('la croissance donne le même résultat en une fois ou image par image', () => {
    const a = withVillage(), b = withVillage();
    const stats = Villages.local(a, a.villages[0]);
    const once = Territory.advance(a.villages[0], stats, 60);
    let steps = 0;
    for (let i = 0; i < 3600; i++) steps += Territory.advance(b.villages[0], stats, 1 / 60);
    assert.near(a.villages[0].area, b.villages[0].area, 1e-6);
    assert.near(steps, once, once * 1e-9);
  });

  test('le territoire rayonne de la lumière pendant le jeu', () => {
    const game = Sim.create(withVillage());
    game.field.particles.length = 0;
    game.state.player.x = 50000; // le joueur ne ramasse pas le jardin
    for (let i = 0; i < 600; i++) Sim.step(game, CONFIG.step, Sim.emptyInput());
    assert.ok(game.state.light > 0);
    assert.equal(game.state.totalLight, game.state.light);
  });

  test('chaque village grandit et rayonne de son côté', () => {
    const state = State.create(1);
    const a = village(state);
    const b = village(state, { x: 3000 });
    const game = Sim.create(state);
    for (let i = 0; i < 600; i++) Sim.step(game, CONFIG.step, Sim.emptyInput());
    const start = Math.PI * CONFIG.territory.startRadius ** 2;
    assert.ok(a.area > start && b.area > start);
    // Les jardins de l'origine et ceux du second village grandissent au même rythme.
    assert.near(a.area, b.area, 1e-6);
  });

  test('fonder un village émet un événement pour l’interface', () => {
    const state = State.create(1);
    const game = Sim.create(state);
    village(state, { type: 'bastion' });
    Sim.step(game, CONFIG.step, Sim.emptyInput());
    const e = game.events.find((x) => x.type === 'village');
    assert.ok(e && e.village === 'bastion' && e.first);
  });

  test('la pulsation se recharge plus vite dans un territoire', () => {
    const inside = Sim.create(withVillage());
    const outside = Sim.create(withVillage());
    outside.state.player.x = 5000;
    for (const g of [inside, outside]) {
      Sim.pulse(g);
      for (let i = 0; i < 60; i++) Sim.step(g, CONFIG.step, Sim.emptyInput());
    }
    assert.ok(inside.pulse.cooldown < outside.pulse.cooldown - 0.5);
  });

  test('les améliorations du territoire apparaissent une fois un village fondé', () => {
    const state = State.create(1);
    state.totalLight = 1e6;
    assert.equal(Catalog.get('expansion').revealed(state), false);
    village(state);
    assert.ok(Catalog.get('expansion').revealed(state));
  });

  test("l'absence fait grandir les territoires et rapporte de la lumière", () => {
    const state = withVillage();
    const far = village(state, { x: 4000 });
    const r0 = Territory.radius(state.villages[0]);
    const report = Offline.apply(state, 3600);
    assert.equal(report.applied, 3600);
    assert.equal(report.capped, false);
    assert.ok(report.light > 0 && state.light === report.light);
    assert.ok(report.radiusAfter > r0);
    assert.ok(Territory.radius(far) > r0, 'le second village grandit aussi');
    assert.equal(report.villages, 2);
    assert.ok(Offline.worthShowing(report));
  });

  test("l'absence est plafonnée par la Mémoire", () => {
    const state = withVillage();
    const cap = Stats.compute(state).offlineCap;
    const report = Offline.apply(state, cap * 3);
    assert.equal(report.applied, cap);
    assert.ok(report.capped);
    state.upgrades.memory = 2;
    assert.equal(Stats.compute(state).offlineCap, cap + 2 * 3600);
  });

  test('une absence courte, négative ou invalide ne fait rien', () => {
    for (const seconds of [-50, NaN, Infinity * 0]) {
      const state = withVillage();
      const report = Offline.apply(state, seconds);
      assert.equal(report.applied, 0);
      assert.equal(state.light, 0);
    }
    assert.equal(Offline.worthShowing(Offline.apply(withVillage(), 30)), false);
  });

  test("sans village, l'absence ne rapporte rien", () => {
    const state = State.create(1);
    const report = Offline.apply(state, 3600);
    assert.equal(report.light, 0);
    assert.equal(report.radiusAfter, 0);
    assert.equal(Offline.worthShowing(report), false);
  });
})();
