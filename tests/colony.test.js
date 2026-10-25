(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Stats, Territory, Villages, Garden, Colony, Catalog, Sim, Offline, Save } = Vide;
  const dt = CONFIG.step;

  // Partie avec un village à l'origine, territoire de rayon donné, champ vide autour du joueur (placé loin).
  function colonyGame(radius, lueurs) {
    const state = State.create(3);
    village(state, { radius, beings: lueurs ? { lueur: lueurs } : {} });
    state.player.x = 50000; // le joueur ne gêne pas les lueurs
    const game = Sim.create(state);
    game.field.particles.length = 0;
    return game;
  }

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  test('sans village, le jardin reste vide', () => {
    const game = Sim.create(State.create(1));
    assert.equal(game.garden.particles.length, 0);
  });

  test('le jardin naît dans le territoire, loin du cœur', () => {
    const game = colonyGame(300);
    const g = game.garden.particles;
    const v = game.state.villages[0];
    assert.equal(g.length, Garden.targetCount(v, Villages.statsOf(game, v)));
    assert.ok(g.length > 10);
    for (const p of g) {
      const d = Math.hypot(p.x, p.y);
      assert.ok(Territory.contains(v, p.x, p.y) && d >= CONFIG.garden.foyerGap, `distance ${d}`);
    }
  });

  test('dans un territoire immense, le jardin naît à portée des foyers (cœur, anciens cœurs, relais)', () => {
    const game = colonyGame(2500);
    const v = game.state.villages[0];
    const homes = Garden.hearths(v);
    assert.equal(homes.length, 1, 'le cœur seul');
    for (const p of game.garden.particles) {
      assert.ok(Math.hypot(p.x - v.x, p.y - v.y) <= CONFIG.garden.reach + Territory.CELL, 'à portée du cœur');
    }
    // Un ancien cœur (une cité) est un foyer de plus.
    v.districts.push({ x: 1800, y: 0, type: 'atelier' });
    assert.equal(Garden.hearths(v).length, 2);
  });

  test('une lueur qui ne voit rien autour d’elle part chercher plus loin, dans tout son territoire', () => {
    const game = colonyGame(1500, 1);
    const v = game.state.villages[0];
    game.garden.particles.length = 0;
    const far = Garden.spawn(game.garden, v, true, 1, [{ x: 1200, y: 0 }]);
    assert.ok(far && Math.hypot(far.x, far.y) > Vide.Stats.compute(game.state).beingSense + 50, 'loin de la lueur');
    const max = CONFIG.garden.max;
    CONFIG.garden.max = 1; // (plus rien ne naît : il y a déjà cette lumière)
    try {
      run(game, 3);
      assert.equal(game.colony.beings[0].target, far, 'elle l’a repérée');
    } finally {
      CONFIG.garden.max = max;
    }
  });

  test('une lueur s’achète une fois un village fondé, toujours au même prix', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e6;
    assert.equal(Catalog.get('lueur').revealed(state), false);
    const v = village(state);
    const first = Catalog.get('lueur').cost(state).light;
    assert.ok(Catalog.buy(state, 'lueur'));
    assert.equal(v.beings.lueur, 1);
    assert.equal(Catalog.get('lueur').cost(state).light, first);
  });

  test('la population est plafonnée', () => {
    const state = State.create(1);
    const v = village(state);
    state.light = state.totalLight = 1e12;
    v.beings.lueur = Stats.compute(state).beingCap;
    assert.equal(Catalog.get('lueur').blocked(state), 'population pleine : un nid');
    assert.equal(Catalog.buy(state, 'lueur'), false);
  });

  test('les êtres vivants suivent les effectifs', () => {
    const game = colonyGame(200, 2);
    const v = game.state.villages[0];
    assert.equal(game.colony.beings.length, 2);
    v.beings.lueur = 4;
    Colony.sync(game);
    assert.equal(game.colony.beings.length, 4);
    v.beings.lueur = 1;
    Colony.sync(game);
    assert.equal(game.colony.beings.length, 1);
  });

  test("la naissance de la première lueur est annoncée", () => {
    const game = colonyGame(200, 0);
    game.state.villages[0].beings.lueur = 1;
    Sim.step(game, dt, Sim.emptyInput());
    assert.ok(game.events.some((e) => e.type === 'birth' && e.first));
  });

  test('les lueurs récoltent le jardin et rapportent la lumière au cœur du village', () => {
    const game = colonyGame(250, 3);
    const v = game.state.villages[0];
    const radiation = Territory.production(v, Villages.statsOf(game, v));
    run(game, 40);
    const fromRadiation = radiation * 40 * 1.01; // le territoire grandit un peu pendant le test
    assert.ok(game.state.light > fromRadiation + 10, `lumière ${game.state.light}, rayonnement ~${fromRadiation}`);
    assert.ok(v.rate > 0);
  });

  test('une lueur ne porte pas plus que sa capacité', () => {
    const game = colonyGame(250, 1);
    let max = 0;
    for (let i = 0; i < 60 * 30; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      max = Math.max(max, game.colony.beings[0].carry);
    }
    const capacity = Villages.statsOf(game, game.state.villages[0]).beingCapacity;
    assert.ok(max > 0 && max <= capacity, `charge max ${max}`);
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

  test("pendant l'absence, les êtres de chaque village rapportent au rythme mesuré", () => {
    const state = State.create(1);
    village(state, { beings: { lueur: 2 } }).rate = 5;
    village(state, { x: 3000, beings: { lueur: 1 } }).rate = 1;
    const report = Offline.apply(state, 1000);
    assert.near(report.brought, 6000, 1e-6);
    assert.ok(report.radiated > 0);
    assert.near(report.light, report.radiated + report.brought, 1e-6);
  });

  test("sans être, le rythme mémorisé ne rapporte rien", () => {
    const state = State.create(1);
    village(state).rate = 5;
    assert.equal(Offline.apply(state, 1000).brought, 0);
  });

  test('une sauvegarde de la 0.2 (format 2) se charge, avec son territoire devenu village', () => {
    const text = JSON.stringify({ format: 2, state: { light: 5, territory: { lit: true, area: 50000 } } });
    const result = Save.deserialize(text);
    assert.ok(result.ok);
    assert.equal(result.state.villages.length, 1);
    assert.deepEqual(result.state.villages[0].beings, {});
    assert.equal(result.state.villages[0].rate, 0);
    assert.equal(result.state.villages[0].area, 50000);
  });

  test('les effectifs sauvegardés sont nettoyés', () => {
    const clean = (beings, rate) => Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, beings, rate }] }).villages[0];
    const v = clean({ lueur: 4, fantome: 3, autre: -1 }, -2);
    assert.deepEqual(v.beings, { lueur: 4 });
    assert.equal(v.rate, 0);
    assert.deepEqual(clean({ lueur: 2.5 }).beings, {});
  });

  test('la grille spatiale trouve les mêmes voisins qu’un parcours complet', () => {
    const { Grid, util } = Vide;
    const rng = util.rng(5);
    const items = Array.from({ length: 500 }, () => ({ x: (rng() - 0.5) * 2000, y: (rng() - 0.5) * 2000 }));
    const grid = Grid.create(48);
    for (const it of items) Grid.insert(grid, it);
    for (let k = 0; k < 50; k++) {
      const x = (rng() - 0.5) * 2000, y = (rng() - 0.5) * 2000, r = rng() * 150;
      const found = new Set();
      Grid.near(grid, x, y, r, (o) => { if (Math.hypot(o.x - x, o.y - y) <= r) found.add(o); });
      const brute = items.filter((o) => Math.hypot(o.x - x, o.y - y) <= r);
      assert.equal(found.size, brute.length);
      for (const o of brute) assert.ok(found.has(o));
    }
    Grid.clear(grid);
    let n = 0;
    Grid.near(grid, 0, 0, 5000, () => n++);
    assert.equal(n, 0, 'vidée');
  });

  test('des centaines d’êtres restent légers à simuler', () => {
    const state = State.create(3);
    for (let k = 0; k < 4; k++) {
      village(state, { x: k * 3000, radius: 700, beings: { lueur: 60, batisseur: 3, gardien: 20, etincelle: 10, veilleuse: 7 } });
    }
    state.player.x = 500;
    const game = Sim.create(state);
    for (const v of state.villages) Vide.Shadows.startTide(game, v);
    const t0 = Date.now();
    run(game, 5);
    const ms = (Date.now() - t0) / 300;
    assert.equal(game.colony.beings.length, 400);
    assert.ok(ms < 12, `${ms.toFixed(2)} ms par pas`);
  });
})();
