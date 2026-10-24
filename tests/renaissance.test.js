(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Stats, Territory, Structures, Catalog, Sim, Renaissance, Offline, Save, Shadows } = Vide;
  const dt = CONFIG.step;

  // Une partie bien avancée, prête à renaître.
  function advanced() {
    const state = State.create(41);
    state.totalLight = 9e6;
    state.light = 2e6;
    state.upgrades = { reach: 10, value: 8, expansion: 5 };
    Territory.light(state);
    state.territory.area = Math.PI * 500 * 500;
    state.beings = { lueur: 10, batisseur: 2, gardien: 3 };
    Structures.plan(state, 'nid').work = 40;
    state.echoes = 50;
    state.tides = 9;
    state.player.x = 2000;
    state.colossi.veilleur = 'tamed';
    state.zones.discovered.push('brume');
    state.lore.push('eveil');
    state.stats.shadows = 40;
    return state;
  }

  test('les souvenirs suivent la racine carrée de la lumière récoltée', () => {
    const unit = CONFIG.renaissance.unit;
    const state = State.create(1);
    state.totalLight = 4 * unit;
    assert.equal(Renaissance.gain(state), 2);
    state.totalLight = 100 * unit;
    assert.equal(Renaissance.gain(state), 10);
    state.runStart = 100 * unit - 9 * unit;
    assert.equal(Renaissance.gain(state), 3, 'seule compte la lumière depuis la dernière renaissance');
  });

  test('impossible de renaître trop tôt', () => {
    const state = State.create(1);
    state.totalLight = CONFIG.renaissance.threshold - 1;
    assert.ok(Catalog.get('renaissance').blocked(state));
    assert.equal(Catalog.buy(state, 'renaissance'), false);
    assert.equal(state.renaissances, 0);
  });

  test('renaître : on perd la partie, on garde souvenirs, colosses, zones, journal', () => {
    const state = advanced();
    const earned = Renaissance.gain(state);
    assert.ok(Catalog.buy(state, 'renaissance'));
    assert.equal(state.memories, earned);
    assert.equal(state.renaissances, 1);
    assert.equal(state.light, 0);
    assert.deepEqual(state.upgrades, {});
    assert.deepEqual(state.beings, {});
    assert.deepEqual(state.buildings, []);
    assert.equal(state.echoes, 0);
    assert.equal(state.tides, 0);
    assert.equal(state.territory.lit, false);
    assert.deepEqual(state.player, { x: 0, y: 0 });
    assert.equal(state.totalLight, 9e6, 'la lumière de toute une vie reste comptée');
    assert.equal(state.colossi.veilleur, 'tamed');
    assert.ok(state.zones.discovered.includes('brume'));
    assert.ok(state.lore.includes('eveil'));
    assert.equal(state.stats.shadows, 40);
    assert.equal(Renaissance.gain(state), 0, 'il faut récolter à nouveau');
  });

  test('les souvenirs s’investissent dans des bienfaits qui survivent aux renaissances', () => {
    const state = advanced();
    Catalog.buy(state, 'renaissance');
    assert.ok(Catalog.get('ancientGlow').revealed(state));
    assert.ok(Catalog.buy(state, 'ancientGlow'));
    assert.equal(state.legacy.ancientGlow, 1);
    assert.near(Stats.compute(state).lightMult, 1.25, 1e-9);
    state.totalLight += 9e6;
    Catalog.buy(state, 'renaissance');
    assert.equal(state.legacy.ancientGlow, 1, 'toujours là après une deuxième renaissance');
  });

  test('Racines et Éveil précoce : un meilleur départ', () => {
    const state = advanced();
    state.legacy = { roots: 2, earlyWake: 3 };
    Renaissance.perform(state);
    assert.ok(state.territory.lit);
    assert.near(Territory.radius(state), CONFIG.territory.startRadius + 100, 1e-6);
    assert.equal(state.beings.lueur, 3);
  });

  test('Souffle ancien et Mémoire profonde se cumulent aux améliorations', () => {
    const state = State.create(1);
    state.upgrades.pulse = 5;
    state.upgrades.memory = 2;
    const before = Stats.compute(state);
    state.legacy = { ancientBreath: 2, deepMemory: 1 };
    const after = Stats.compute(state);
    assert.near(after.pulseCooldown, before.pulseCooldown * 0.81, 1e-9);
    assert.equal(after.offlineCap, before.offlineCap + 2 * 3600);
  });

  test("l'Éclat ancien multiplie toute la lumière, y compris pendant l'absence", () => {
    const a = State.create(1), b = State.create(1);
    for (const s of [a, b]) Territory.light(s);
    b.legacy.ancientGlow = 4;
    const ra = Offline.apply(a, 3600), rb = Offline.apply(b, 3600);
    assert.near(rb.light, ra.light * 2, 1e-6);
  });

  test('le monde vivant repart à zéro au pas suivant une renaissance', () => {
    const state = advanced();
    const game = Sim.create(state);
    Shadows.spawn(game, 'errante', 100, 0, 'tide');
    game.field.particles.length = 0;
    Catalog.buy(state, 'renaissance');
    Sim.step(game, dt, Sim.emptyInput());
    assert.equal(game.shadows.list.length, 0);
    assert.equal(game.colony.beings.length, 0);
    assert.equal(game.garden.particles.length, 0);
    assert.ok(game.field.particles.length > 0, 'le vide se remplit de nouveau autour de toi');
    assert.ok(game.events.some((e) => e.type === 'renaissance'));
    assert.equal(game.colossi.find((c) => c.id === 'veilleur').mode, 'resident', 'le Veilleur reste avec toi');
  });

  test('la renaissance demande confirmation', () => {
    const state = advanced();
    const question = Catalog.get('renaissance').confirm(state);
    assert.ok(question.includes('souvenir') && question.includes('perdras'));
  });

  test('une sauvegarde de la 0.9 (format 8) se charge, sans souvenir', () => {
    const result = Save.deserialize(JSON.stringify({ format: 8, state: { totalLight: 50 } }));
    assert.ok(result.ok);
    assert.equal(result.state.memories, 0);
    assert.deepEqual(result.state.legacy, {});
    assert.equal(result.state.renaissances, 0);
    assert.equal(result.state.runStart, 0);
  });

  test('souvenirs et héritage sont relus et nettoyés', () => {
    const state = Save.sanitize({
      totalLight: 100, memories: 7, renaissances: 2, runStart: 500,
      legacy: { ancientGlow: 3, roots: 99, inconnu: 2, reach: 4 },
      upgrades: { reach: 2, ancientGlow: 5 },
    });
    assert.equal(state.memories, 7);
    assert.equal(state.renaissances, 2);
    assert.equal(state.runStart, 100, 'jamais au-delà de la lumière totale');
    assert.deepEqual(state.legacy, { ancientGlow: 3, roots: Vide.Economy.get('roots').max });
    assert.deepEqual(state.upgrades, { reach: 2 });
  });
})();
