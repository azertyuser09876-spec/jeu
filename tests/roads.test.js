(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Catalog, Sim, Roads, Offline, Save, Renaissance } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, input) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, input || Sim.emptyInput());
  }

  // Trois villages en ligne : à l'origine, à 1 500 et à 4 000.
  function three() {
    const state = State.create(1);
    state.light = state.totalLight = 1e9;
    const a = village(state, { beings: { batisseur: 1 } });
    const b = village(state, { x: 1500 });
    const c = village(state, { x: 4000 });
    return { state, a, b, c };
  }

  test('une route se planifie depuis un village, vers le plus proche pas encore relié', () => {
    const { state, a, b, c } = three();
    assert.ok(Catalog.get('route').revealed(state));
    const first = Catalog.get('route').cost(state).light;
    assert.equal(first, Math.ceil(CONFIG.roads.costPerUnit * 1500));
    assert.ok(Catalog.buy(state, 'route'));
    assert.deepEqual(state.roads[0], { a: a.id, b: b.id, work: 0 });
    // La suivante relie le prochain plus proche, et coûte plus (plus longue, et une route de plus).
    assert.equal(Roads.candidate(state, a), c);
    assert.ok(Catalog.get('route').cost(state).light > first * 2);
    assert.ok(Catalog.buy(state, 'route'));
    assert.equal(Catalog.get('route').blocked(state), 'aucun village à relier');
    state.player.x = 800;
    assert.equal(Catalog.get('route').blocked(state), 'rejoins un village');
  });

  test('sans bâtisseur à aucun bout, pas de route', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e9;
    village(state);
    village(state, { x: 1500 });
    assert.equal(Catalog.get('route').blocked(state), 'il faut un bâtisseur');
  });

  test('les bâtisseurs des deux bouts la construisent ; achevée, elle est annoncée', () => {
    const { state, a, b } = three();
    b.beings.batisseur = 1;
    const road = Roads.plan(state, a, b);
    state.player.x = 50000;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, 10);
    assert.near(road.work, 2 * CONFIG.roads.buildSpeed * 10, 1, 'deux bâtisseurs');
    assert.equal(Roads.isDone(state, road), false);
    run(game, 1500 / (2 * CONFIG.roads.buildSpeed));
    assert.ok(Roads.isDone(state, road));
    assert.ok(game.events.some((e) => e.type === 'road' && e.first));
    assert.deepEqual(Roads.neighbors(state, a), [b]);
  });

  test('sur une route achevée, la lumière file plus vite', () => {
    const travel = (built) => {
      const { state, a, b } = three();
      const road = Roads.plan(state, a, b);
      if (built) road.work = Roads.length(state, road);
      state.player.x = 300;
      const game = Sim.create(state);
      const input = Sim.emptyInput();
      input.move.x = 1;
      run(game, 3, input);
      return state.player.x - 300;
    };
    assert.ok(travel(true) > travel(false) * 1.4);
  });

  test('une route part de chaque cœur par l’avenue la mieux tournée, passe la porte, puis file droit vers l’autre', () => {
    const state = State.create(4);
    const a = village(state, { radius: 520 });
    const b = village(state, { x: 2600, y: 900, radius: 400 });
    const w = Vide.Walls.plan(a);
    w.work = Vide.Walls.workOf(w);
    const path = Roads.route(a, b);
    assert.equal(path.length, 4);
    assert.deepEqual([path[0].x, path[0].y, path[3].x, path[3].y], [a.x, a.y, b.x, b.y]);
    // La sortie : sur une avenue (donc par une porte), passé l'enceinte ; l'avenue la mieux tournée vers l'autre.
    const out = path[1];
    const angle = Math.atan2(out.y - a.y, out.x - a.x);
    assert.near(Vide.Plan.offAvenue(a, angle), 0, 1e-9);
    assert.ok(Math.hypot(out.x - a.x, out.y - a.y) > Vide.Walls.radius(w));
    const toward = Math.atan2(b.y - a.y, b.x - a.x);
    assert.ok(Math.abs(Math.atan2(Math.sin(angle - toward), Math.cos(angle - toward))) <= Math.PI / Vide.Plan.AVENUES + 1e-9);
    assert.near(Vide.Plan.offAvenue(b, Math.atan2(path[2].y - b.y, path[2].x - b.x)), 0, 1e-9);
    // Le long du tracé, une route achevée fait filer la lumière ; à côté, non.
    const road = { a: a.id, b: b.id, work: 0 };
    road.work = Roads.length(state, road);
    state.roads.push(road);
    for (const f of [0.1, 0.5, 0.9]) {
      const p = Roads.along(path, f);
      assert.ok(Roads.onRoad(state, p.x, p.y), `${f}`);
    }
    const mid = Roads.along(path, 0.5);
    assert.ok(!Roads.onRoad(state, mid.x + 300, mid.y - 900));
    // Morceaux et points d'un tracé.
    assert.near(Roads.pathLength(Roads.slice(path, 0.2, 0.7)), Roads.pathLength(path) * 0.5, 1e-6);
  });

  test('pendant l’absence, les routes avancent', () => {
    const { state, a, b } = three();
    const road = Roads.plan(state, a, b);
    Offline.apply(state, 3600);
    assert.ok(Roads.isDone(state, road));
  });

  test('routes sauvegardées : relues, nettoyées ; migration ; renaissance', () => {
    const { state, a, b, c } = three();
    Roads.plan(state, a, b).work = 300;
    const back = Save.deserialize(Save.serialize(state, 1)).state;
    assert.deepEqual(back.roads, state.roads);
    const bad = Save.sanitize({
      villages: state.villages,
      roads: [{ a: a.id, b: b.id, work: 1e9 }, { a: b.id, b: a.id, work: 5 }, { a: a.id, b: a.id }, { a: a.id, b: 99 },
        { a: c.id, b: a.id, work: -4 }, 'x', null],
    });
    assert.deepEqual(bad.roads, [{ a: a.id, b: b.id, work: 1500 }, { a: a.id, b: c.id, work: 0 }]);
    const old = Save.deserialize(JSON.stringify({ format: 11, state: { villages: [] } }));
    assert.deepEqual(old.state.roads, []);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.deepEqual(state.roads, []);
  });
})();
