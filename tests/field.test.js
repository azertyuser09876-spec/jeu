(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Stats, Field, Sim } = Vide;

  const baseStats = () => Stats.compute(State.create(1));
  const dt = CONFIG.step;

  // Champ vide (sans remplissage automatique) pour contrôler précisément chaque particule.
  function emptyGame() {
    const game = Sim.create(State.create(1));
    game.field.particles.length = 0;
    return game;
  }

  // Avance d'un pas sans reremplir le champ (densité nulle).
  function stepNoRefill(field, player, stats) {
    return Field.update(field, player, { ...stats, density: 0 }, dt);
  }

  test('le nombre cible suit la densité et respecte le plafond', () => {
    const s = baseStats();
    const base = Field.targetCount(s);
    assert.ok(base > 50, `base = ${base}`);
    assert.ok(Field.targetCount({ ...s, density: 2 }) > base * 1.9);
    assert.equal(Field.targetCount({ ...s, density: 1000 }), CONFIG.field.maxParticles);
  });

  test('le remplissage initial atteint la cible, dans le disque, hors de portée', () => {
    const s = baseStats();
    const field = Field.create(3);
    Field.fill(field, 100, -50, s);
    assert.equal(field.particles.length, Field.targetCount(s));
    for (const p of field.particles) {
      const d = Math.hypot(p.x - 100, p.y + 50);
      assert.ok(d <= CONFIG.field.radius + 1e-6, `trop loin : ${d}`);
      assert.ok(d >= s.reach, `apparue dans la portée : ${d}`);
    }
  });

  test('le champ est déterministe pour une même graine', () => {
    const s = baseStats();
    const a = Field.create(9), b = Field.create(9);
    Field.fill(a, 0, 0, s);
    Field.fill(b, 0, 0, s);
    assert.deepEqual(a.particles, b.particles);
  });

  test("une particule dans la portée est attrapée puis récoltée", () => {
    const s = baseStats();
    const field = Field.create(1);
    const player = { x: 0, y: 0 };
    Field.place(field, s.reach - 5, 0, false, true);
    let total = 0;
    for (let i = 0; i < 120; i++) total += stepNoRefill(field, player, s).value;
    assert.equal(total, 1);
    assert.equal(field.particles.length, 0);
  });

  test('une particule hors de portée reste libre', () => {
    const s = baseStats();
    const field = Field.create(1);
    const p = Field.place(field, s.reach + 50, 0, false, true);
    for (let i = 0; i < 60; i++) stepNoRefill(field, { x: 0, y: 0 }, s);
    assert.equal(p.caught, -1);
    assert.equal(field.particles.length, 1);
  });

  test("une particule attrapée rattrape une lumière qui s'enfuit", () => {
    const s = baseStats();
    const field = Field.create(1);
    const player = { x: 0, y: 0 };
    // Attrapée au premier pas, puis la lumière fuit vers la droite.
    const p = Field.place(field, -s.reach / 2, 0, false, true);
    let total = 0;
    for (let i = 0; i < 300 && field.particles.length; i++) {
      player.x += 400 * dt; // bien plus vite que la vitesse de base
      total += stepNoRefill(field, player, s).value;
    }
    assert.ok(p.caught > 0.3, 'la poursuite doit durer un moment');
    assert.equal(total, 1);
  });

  test('les particules trop lointaines disparaissent', () => {
    const s = baseStats();
    const field = Field.create(1);
    Field.place(field, CONFIG.field.despawnRadius + 10, 0, false, true);
    stepNoRefill(field, { x: 0, y: 0 }, s);
    assert.equal(field.particles.length, 0);
  });

  test('le champ se recharge progressivement, pas instantanément', () => {
    const s = baseStats();
    const field = Field.create(1);
    const player = { x: 0, y: 0 };
    Field.update(field, player, s, dt);
    assert.ok(field.particles.length <= 5, `trop d'un coup : ${field.particles.length}`);
    for (let i = 0; i < CONFIG.field.refillTime * 60 * 1.5; i++) Field.update(field, player, s, dt);
    assert.ok(field.particles.length >= Field.targetCount(s) * 0.9, `${field.particles.length}`);
  });

  test('une particule rare vaut plus', () => {
    const game = emptyGame();
    Field.place(game.field, 0, 0, true, true);
    Sim.step(game, dt, Sim.emptyInput());
    assert.equal(game.state.light, CONFIG.field.rareValue);
    assert.equal(game.state.stats.collected, 1);
  });

  test('la récolte applique le multiplicateur de valeur et alimente le total', () => {
    const game = emptyGame();
    Field.place(game.field, 0, 0, false, true);
    Field.place(game.field, 1, 1, false, true);
    // On force le multiplicateur via Stats, comme le fera une amélioration.
    const original = Stats.compute;
    Stats.compute = (state) => ({ ...original(state), value: 3 });
    try {
      Sim.step(game, dt, Sim.emptyInput());
    } finally {
      Stats.compute = original;
    }
    assert.equal(game.state.light, 6);
    assert.equal(game.state.totalLight, 6);
  });

  test('le débit affiché augmente quand on récolte', () => {
    const game = emptyGame();
    for (let i = 0; i < 60; i++) {
      Field.place(game.field, 0, 0, false, true);
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(game.rate > 5, `débit = ${game.rate}`);
  });

  test('catchWithin attrape seulement les particules dans le rayon', () => {
    const field = Field.create(1);
    const near = Field.place(field, 100, 0, false, true);
    const far = Field.place(field, 300, 0, false, true);
    assert.equal(Field.catchWithin(field, 0, 0, 200), 1);
    assert.ok(near.caught >= 0);
    assert.equal(far.caught, -1);
  });
})();
