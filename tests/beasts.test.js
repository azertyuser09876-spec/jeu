(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Colossus, Engines, Structures, Villages } = Vide;
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

  // --- La Méduse ---

  test('la Méduse se fait entendre une fois l’Oiseau d’aube et la Tisseuse apaisés', () => {
    const state = State.create(1);
    const d = Colossus.def('meduse');
    state.colossi.oiseau = 'tamed';
    assert.equal(d.requires(state), false);
    state.colossi.tisseuse = 'tamed';
    assert.ok(d.requires(state));
  });

  test('ses sceaux ne s’ouvrent qu’au sommet de chaque pulsation', () => {
    const { game, c } = facing('meduse', 700);
    c.beat = 0.2;
    assert.equal(Colossus.sealHit(game, c, 50), false);
    assert.equal(c.seals[0].hp, c.seals[0].max);
    assert.ok(game.events.some((e) => e.type === 'closed'));
    c.beat = 0.85;
    Colossus.sealHit(game, c, 50);
    assert.equal(c.seals[0].hp, c.seals[0].max - 50);
    // Pliée, elle reste ouverte.
    c.beat = 0.1;
    Colossus.hit(game, c, c.def.stagger + 1);
    Colossus.sealHit(game, c, 10);
    assert.equal(c.seals[0].hp, c.seals[0].max - 70);
  });

  test('elle pulse à intervalles réguliers, et avance par à-coups', () => {
    const { state, game, c } = facing('meduse', 1300);
    c.attackCd = 1e9;
    c.beat = 0.95;
    const spot = { x: state.player.x, y: state.player.y };
    const d0 = Math.hypot(spot.x - c.x, spot.y - c.y);
    let pulses = 0, fast = 0, slow = Infinity;
    for (let i = 0; i < 60 * 10; i++) {
      state.player.x = spot.x;
      state.player.y = spot.y;
      Sim.step(game, dt, Sim.emptyInput());
      if (c.pulsed) pulses++;
      const v = Math.hypot(c.vx, c.vy);
      if (i > 30) {
        fast = Math.max(fast, v);
        slow = Math.min(slow, v);
      }
    }
    const period = Vide.Beasts.medusa.period(c);
    assert.ok(Math.abs(pulses - Math.round(10 / period)) <= 1, `${pulses} pulsations`);
    assert.ok(fast > slow * 3, 'des à-coups');
    assert.ok(Math.hypot(spot.x - c.x, spot.y - c.y) < d0 - 100, 'elle s’approche');
  });

  test('son fouet frappe le long de ses trois lignes', () => {
    const { state, game, c } = facing('meduse', 500);
    c.attackCd = 1e9;
    game.vitality.invulnerable = 0;
    Colossus.startAttack(game, c, 'lash');
    const line = c.attack.lines[1];
    const spot = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
    const hp = game.vitality.hp;
    for (let i = 0; i < Math.round((c.attack.telegraph + 0.1) / dt); i++) {
      state.player.x = spot.x;
      state.player.y = spot.y;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(game.vitality.hp <= hp - Colossus.ATTACKS.lash.damage + 1e-9);
  });

  test('apaisée, elle flotte jusqu’au village abîmé et le répare à chaque pulsation', () => {
    const { state, game, c } = facing('meduse', 700);
    const v = state.villages[0];
    const b = Structures.plan(state, v, 'nid');
    b.work = Structures.def('nid').work;
    Structures.damage(game, b, Structures.def('nid').hp * 0.9);
    const hurt = Structures.hp(game, b);
    state.colossi.meduse = 'tamed';
    c.mode = 'resident';
    c.calm = 1;
    c.x = v.x + 300;
    c.y = v.y;
    state.player.x = -30000;
    let mended = false;
    for (let i = 0; i < 60 * 12; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      mended = mended || game.events.some((e) => e.type === 'mended');
    }
    assert.ok(mended);
    assert.ok(Structures.hp(game, b) > hurt, 'réparé');
  });

  // --- La Nuée ---

  test('la Nuée se fait entendre une fois le Léviathan apaisé', () => {
    const state = State.create(1);
    assert.equal(Colossus.def('nuee').requires(state), false);
    state.colossi.leviathan = 'tamed';
    assert.ok(Colossus.def('nuee').requires(state));
  });

  test('ses éclats protègent son noyau ; l’onde de pulsation les détruit, et le noyau s’offre', () => {
    const { game, c } = facing('nuee', 900);
    c.attackCd = 1e9;
    run(game, 1);
    const S = Vide.Beasts.SWARM;
    assert.ok(Vide.Beasts.swarm.cover(c) >= S.guard, 'à l’abri');
    assert.equal(Colossus.sealHit(game, c, 50), false);
    assert.ok(game.events.some((e) => e.type === 'shielded'));
    const n = c.nuclei[c.active];
    const before = c.shards.length;
    game.pulse.id = (game.pulse.id || 0) + 1;
    Colossus.pulseHit(game, n.x, n.y, 300);
    assert.ok(c.shards.length < before, 'des éclats détruits');
    assert.ok(c.seals[0].hp < c.seals[0].max, 'le noyau est touché dans la même onde');
  });

  test('l’armée dévore ses éclats ; ils renaissent des noyaux', () => {
    const { game, c } = facing('nuee', 900);
    c.attackCd = 1e9;
    const before = c.shards.length;
    Colossus.hit(game, c, Vide.Beasts.SWARM.eat * 40);
    assert.equal(c.shards.length, before - 40);
    run(game, 3);
    assert.ok(c.shards.length > before - 40 + 15, 'ils renaissent');
  });

  test('au contact de ses éclats, la lumière brûle', () => {
    const { state, game, c } = facing('nuee', 900);
    c.attackCd = 1e9;
    game.vitality.invulnerable = 0;
    const hp = game.vitality.hp;
    for (let i = 0; i < 60; i++) {
      state.player.x = c.x + 100;
      state.player.y = c.y;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(game.vitality.hp < hp - 5);
  });

  test('le tourbillon referme un anneau d’éclats sur la lumière ; le noyau, lui, se découvre', () => {
    const { state, game, c } = facing('nuee', 700);
    c.attackCd = 1e9;
    Colossus.startAttack(game, c, 'vortex');
    const at = { x: state.player.x, y: state.player.y };
    run(game, c.attack.telegraph + Colossus.ATTACKS.vortex.active * 0.9);
    let near = 0;
    for (const f of c.shards) if (Math.hypot(f.x - at.x, f.y - at.y) < 150) near++;
    assert.ok(near > c.shards.length * 0.5, `${near} éclats autour`);
    assert.equal(Vide.Beasts.swarm.guard(game, c), null, 'noyau découvert');
  });

  test('apaisée, sa nuée entoure la lumière sans la brûler', () => {
    const { state, game, c } = facing('nuee', 900);
    state.colossi.nuee = 'tamed';
    c.mode = 'resident';
    c.calm = 1;
    game.vitality.invulnerable = 0;
    const hp = game.vitality.hp;
    run(game, 10);
    assert.ok(Math.hypot(c.x - state.player.x, c.y - state.player.y) < 200);
    assert.ok(game.vitality.hp >= hp - 1e-9);
  });

  // --- Le Dormeur ---

  test('le Dormeur ne s’entend qu’une fois tous les autres apaisés', () => {
    const state = State.create(1);
    const d = Colossus.def('dormeur');
    for (const o of Vide.COLOSSI) if (o.id !== 'dormeur' && o.id !== 'nuee') state.colossi[o.id] = 'tamed';
    assert.equal(d.requires(state), false);
    state.colossi.nuee = 'tamed';
    assert.ok(d.requires(state));
  });

  test('il dort : il ne bouge ni ne combat ; on le découvre en approchant', () => {
    const { state, game, c } = facing('dormeur', 1500);
    const at = { x: c.x, y: c.y };
    game.vitality.invulnerable = 0;
    const hp = game.vitality.hp;
    let found = false;
    for (let i = 0; i < 60 * 10; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      found = found || game.events.some((e) => e.type === 'colossusFound' && e.sleeper);
    }
    assert.equal(c.mode, 'sleep');
    assert.equal(Colossus.status(state, 'dormeur'), 'found');
    assert.ok(found);
    assert.ok(Math.hypot(c.x - at.x, c.y - at.y) < 1, 'immobile');
    assert.ok(game.vitality.hp >= hp - 1e-9, 'aucune attaque');
    assert.equal(Colossus.engaged(c), false, 'ni l’armée ni les engins ne s’en prennent à lui');
    assert.equal(Colossus.startMarch(game), null);
  });

  test('ses rêves ne s’atteignent que debout sur son dos ; chacun lâche ses cauchemars', () => {
    const { state, game, c } = facing('dormeur', 3000);
    assert.equal(Colossus.sealHit(game, c, 1e6), false, 'loin de lui');
    assert.ok(game.events.some((e) => e.type === 'asleep'));
    state.player.x = c.x + 100;
    state.player.y = c.y;
    const shadows = game.shadows.list.length;
    assert.ok(Colossus.sealHit(game, c, 1e6));
    assert.equal(c.mode, 'sleep', 'il dort toujours');
    assert.ok(game.shadows.list.length >= shadows + Vide.Beasts.SLEEPER.nightmares);
    assert.ok(game.events.some((e) => e.type === 'nightmare'));
    Colossus.sealHit(game, c, 1e6);
    Colossus.sealHit(game, c, 1e6);
    assert.equal(Colossus.status(state, 'dormeur'), 'tamed');
    run(game, 10);
    assert.ok(Math.hypot(c.x - Colossus.lair(state, c.def).x, c.y - Colossus.lair(state, c.def).y) < 5, 'il reste où il dormait');
  });

  test('éveillé, il laisse bâtir sur son dos : ce village grandit ×3 et rayonne ×2', () => {
    const state = State.create(31);
    village(state, { radius: 200 });
    const at = Colossus.lair(state, Colossus.def('dormeur'));
    const back = village(state, { x: at.x + 100, y: at.y, radius: 200 });
    const base = Villages.local(state, back);
    for (const d of Vide.COLOSSI) state.colossi[d.id] = 'tamed';
    const stats = Vide.Stats.compute(state);
    const on = Villages.local(state, back, stats);
    const off = Villages.local(state, state.villages[0], stats);
    assert.near(on.territoryGrowth, off.territoryGrowth * 3, 1e-6);
    assert.near(on.territoryYield, off.territoryYield * 2, 1e-12);
    assert.ok(base.territoryGrowth < on.territoryGrowth);
    // Au chargement, il est là, sous son village.
    const game = Sim.create(state);
    const c = game.colossi.find((k) => k.id === 'dormeur');
    assert.ok(Math.hypot(c.x - at.x, c.y - at.y) < 1);
  });
})();
