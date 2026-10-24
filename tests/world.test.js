(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Roads, Creatures, Trade, Nests } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, each) {
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      Sim.step(game, dt, Sim.emptyInput());
      if (each) each();
    }
  }

  // --- Convois ---

  // Un atelier plein de matière, relié à des jardins.
  function linked() {
    const state = State.create(31);
    const atelier = village(state, { radius: 300, type: 'atelier' });
    const jardins = village(state, { x: 3000, radius: 300 });
    const road = Roads.plan(state, atelier, jardins);
    road.work = Roads.length(state, road);
    atelier.stock.matiere = 100;
    state.player.x = -20000;
    return { state, atelier, jardins };
  }

  test('un convoi roule sur le tracé de sa route', () => {
    const { state, atelier, jardins } = linked();
    const game = Sim.create(state);
    run(game, CONFIG.trade.every + 0.1);
    const c = game.trade.caravans[0];
    assert.ok(c && c.hp === CONFIG.trade.convoyHp);
    run(game, c.duration / 2 - 0.1);
    const path = Roads.route(state, atelier, jardins);
    const mid = Roads.along(path, c.t / c.duration);
    assert.near(c.x, mid.x, 1e-6);
    assert.near(c.y, mid.y, 1e-6);
  });

  test('les ombres s’en prennent aux convois ; un convoi qui tombe perd sa charge', () => {
    const { state, atelier } = linked();
    const game = Sim.create(state);
    run(game, CONFIG.trade.every + 0.1);
    const c = game.trade.caravans[0];
    run(game, c.duration / 2);
    const s = Vide.Shadows.spawn(game, 'massive', c.x + 40, c.y, 'tide');
    s.home = state.villages[1];
    s.hp = 1e9;
    const before = atelier.stock.matiere;
    let lost = null;
    run(game, 40, () => {
      lost = lost || game.events.find((e) => e.type === 'convoyLost') || null;
      if (game.trade.caravans[0]) s.target = { type: 'convoy', ref: game.trade.caravans[0] };
    });
    assert.ok(lost, 'le convoi est tombé');
    assert.ok(!game.trade.caravans.includes(c));
    assert.ok(atelier.stock.matiere <= before - c.amount + 1e-9, 'sa charge est perdue');
    // Sans arrivée : rien n'a été livré.
    assert.ok(!game.events.some((e) => e.type === 'caravan'));
  });

  test('un convoi de soldats perdu coûte un gardien à l’expéditeur', () => {
    const { state, atelier, jardins } = linked();
    atelier.beings.gardien = 3;
    const game = Sim.create(state);
    game.trade.caravans.push({ from: atelier, to: jardins, kind: 'soldat', amount: 1, price: 10, t: 0, duration: 30, x: 0, y: 0, hp: 5, maxHp: 260 });
    assert.ok(Trade.hurt(game, game.trade.caravans[0], 10));
    assert.equal(atelier.beings.gardien, 2);
  });

  // --- La faune du vide ---

  function wild(zone) {
    const state = State.create(41);
    state.player.x = 0;
    state.player.y = 0;
    const game = Sim.create(state);
    game.region.zone = Vide.ZONES.find((z) => z.id === zone);
    return { state, game };
  }

  test('autour de la lumière vit une faune selon la zone ; restée loin derrière, elle s’efface', () => {
    const { state, game } = wild('brume');
    run(game, CONFIG.creatures.faunaEvery * (CONFIG.creatures.fauna.brume + 2));
    const fauna = game.creatures.list.filter((c) => c.side === 'wild');
    assert.ok(fauna.length >= 1 && fauna.length <= CONFIG.creatures.fauna.brume);
    for (const c of fauna) assert.ok(Creatures.kind(c.kind).wild.zones.includes('brume'));
    // Le Gouffre : la baleine, une seule à la fois.
    const deep = wild('gouffre');
    for (let i = 0; i < 6; i++) {
      deep.game.creatures.faunaClock = 0;
      Creatures.fauna(deep.game, dt);
    }
    assert.ok(deep.game.creatures.list.filter((c) => c.kind === 'baleine').length <= 1);
    // Loin derrière : elle s'efface (une autre naîtra près de la lumière).
    state.player.x = 50000;
    game.creatures.faunaClock = 0;
    Creatures.fauna(game, dt);
    for (const c of fauna) assert.ok(!game.creatures.list.includes(c));
  });

  test('la faune ne fait de mal à personne ; les lucioles fuient la lumière', () => {
    const { state, game } = wild('calme');
    const l = Creatures.spawn(game, 'lucioles', 'wild', null, 120, 0);
    const hp = game.vitality.hp;
    const d0 = Math.hypot(l.x, l.y);
    run(game, 3);
    assert.equal(game.vitality.hp, hp);
    assert.ok(Math.hypot(l.x - state.player.x, l.y - state.player.y) > d0 + 50, 'elles ont fui');
  });

  test('avec des Éleveurs, ta pulsation apprivoise la faune ; avec des Lames, elle la traverse sans mal', () => {
    for (const [faction, tamed] of [['eleveurs', true], ['lames', false]]) {
      const { state, game } = wild('brume');
      state.faction = faction;
      const v = village(state, { x: 600, radius: 250 });
      v.faction = faction;
      const ray = Creatures.spawn(game, 'raie', 'wild', null, 60, 0);
      ray.hp = ray.maxHp * CONFIG.creatures.convertAt + 1;
      const hp = ray.hp;
      Sim.pulse(game);
      run(game, 1);
      if (tamed) {
        assert.equal(ray.side, 'light');
        assert.equal(ray.owner, v);
        assert.equal(v.creatures.raie, 1);
      } else {
        assert.equal(ray.side, 'wild');
        assert.equal(ray.hp, hp, 'pas un coup');
      }
    }
  });

  test('une base de Meutes prend dans sa meute la faune qui erre sur sa noirceur', () => {
    const { state, game } = wild('brume');
    const nest = Nests.add(state, 3000, 0, CONFIG.nests.levelEvery * 2);
    nest.faction = 'meutes';
    const ray = Creatures.spawn(game, 'raie', 'wild', null, nest.x + 20, nest.y);
    ray.anchor = { x: nest.x, y: nest.y };
    run(game, CONFIG.creatures.packTame + 1, () => { ray.x = nest.x + 20; ray.y = nest.y; });
    assert.equal(ray.side, 'shadow');
    assert.equal(ray.owner, nest);
    assert.equal(nest.creatures.raie, 1);
  });
})();
