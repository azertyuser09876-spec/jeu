(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Colossus, Engines } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Le colosse `id` entendu (ceux d'avant apaisés, tous les sceaux étudiés), la lumière à `dist` de lui, en chasse.
  function facing(id, dist) {
    const state = State.create(31);
    village(state, { radius: 300 });
    state.stats.shadows = 1e3;
    state.light = state.totalLight = 1e6;
    for (const d of Vide.COLOSSI) {
      state.studied[d.id] = d.seals.length;
      if (d.id !== id) state.colossi[d.id] = 'tamed';
    }
    state.colossi[id] = 'heard';
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, dt);
    const c = game.colossi.find((k) => k.id === id);
    state.player.x = c.x + dist;
    state.player.y = c.y;
    run(game, 0.1);
    game.vitality.invulnerable = 1e9;
    return { state, game, c };
  }

  // --- L'Oiseau d'aube ---

  test('l’Oiseau d’aube se fait entendre une fois le Veilleur apaisé', () => {
    const state = State.create(1);
    const d = Colossus.def('oiseau');
    assert.equal(d.requires(state), false);
    state.colossi.veilleur = 'tamed';
    assert.ok(d.requires(state));
  });

  test('en vol, il est hors d’atteinte : ni la pulsation, ni le corps à corps ; les traits, si', () => {
    const { game, c } = facing('oiseau', 700);
    run(game, 1);
    assert.ok(c.air > 0.9, `altitude ${c.air}`);
    assert.equal(Colossus.sealHit(game, c, 1e6), false);
    assert.ok(game.events.some((e) => e.type === 'aloft'));
    c.stagger = 0;
    Colossus.hit(game, c, 50, true);
    assert.equal(c.stagger, 0, 'le corps à corps ne l’atteint pas');
    Colossus.hit(game, c, 50);
    assert.equal(c.stagger, 50, 'un trait, si');
  });

  test('sa jauge pleine, il est cloué au sol : ses sceaux sont à portée, et prennent double', () => {
    const { game, c } = facing('oiseau', 700);
    run(game, 0.5);
    Colossus.hit(game, c, c.def.stagger + 1);
    assert.equal(c.mode, 'kneel');
    run(game, 2);
    assert.ok(c.air < 0.1, `altitude ${c.air}`);
    Colossus.sealHit(game, c, 10);
    assert.equal(c.seals[0].hp, c.seals[0].max - 20);
  });

  test('une chaîne le tire au sol tant qu’elle le retient', () => {
    const { state, game, c } = facing('oiseau', 700);
    c.attackCd = 1e9;
    for (let i = 0; i < 60 * 3; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      // L'ancrage le suit, pour le test : il passe toujours à sa portée.
      if (!state.engines.length) Engines.add(state, 'chaine', c.x, c.y);
      state.engines[0].x = c.core.x;
      state.engines[0].y = c.core.y;
      state.engines[0].hp = 30;
    }
    assert.ok(c.bound, 'retenu');
    assert.ok(c.air < 0.2, `altitude ${c.air}`);
  });

  test('de temps en temps, il se pose de lui-même, quelques secondes', () => {
    const { game, c } = facing('oiseau', 700);
    c.attackCd = 1e9;
    c.landClock = 0.1;
    let landed = false;
    for (let i = 0; i < 60 * 3; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      landed = landed || game.events.some((e) => e.type === 'landed');
    }
    assert.ok(landed);
    assert.ok(c.air < 0.3);
    assert.ok(Colossus.sealHit(game, c, 1) === false && c.seals[0].hp < c.seals[0].max, 'son sceau est à portée');
    run(game, 4);
    assert.ok(c.air > 0.5, 'il reprend son vol');
  });

  test('le piqué : annoncé, il rase sa ligne et frappe ce qui s’y trouve', () => {
    const { game, c } = facing('oiseau', 700);
    c.attackCd = 1e9;
    c.landClock = 1e9;
    game.vitality.invulnerable = 0;
    Colossus.startAttack(game, c, 'dive');
    const start = { x: c.x, y: c.y };
    const hp = game.vitality.hp;
    const { player } = game.state;
    const spot = { x: player.x, y: player.y };
    let low = 1;
    for (let i = 0; i < Math.round(3 / dt); i++) {
      player.x = spot.x;
      player.y = spot.y;
      Sim.step(game, dt, Sim.emptyInput());
      low = Math.min(low, c.air);
    }
    assert.ok(game.vitality.hp <= hp - Colossus.ATTACKS.dive.damage + 1e-9, 'touchée');
    assert.ok(Math.hypot(c.x - start.x, c.y - start.y) > 600, 'il a piqué');
    assert.ok(low < 0.5, 'au ras du sol pendant le piqué');
  });

  test('la rafale repousse la lumière', () => {
    const { game, c } = facing('oiseau', 500);
    c.attackCd = 1e9;
    c.landClock = 1e9;
    game.vitality.invulnerable = 0;
    Colossus.startAttack(game, c, 'gale');
    c.attack.origin = { x: c.x, y: c.y };
    c.attack.dir = Math.atan2(game.state.player.y - c.y, game.state.player.x - c.x);
    const before = Math.hypot(game.state.player.x - c.x, game.state.player.y - c.y);
    run(game, c.attack.telegraph + 0.3);
    const after = Math.hypot(game.state.player.x - c.attack.origin.x, game.state.player.y - c.attack.origin.y);
    assert.ok(after > before + 50, `${Math.round(before)} → ${Math.round(after)}`);
  });

  test('apaisé, il accompagne ta lumière et révèle les régions autour de lui', () => {
    const { state, game, c } = facing('oiseau', 700);
    state.colossi.oiseau = 'tamed';
    c.mode = 'resident';
    c.calm = 1;
    state.player.x = c.x + 20000;
    state.player.y = c.y;
    const visited = state.zones.visited.length;
    run(game, 30);
    assert.ok(Math.hypot(c.x - state.player.x, c.y - state.player.y) < 800, 'près de la lumière');
    assert.ok(state.zones.visited.length > visited + 3);
  });
})();
