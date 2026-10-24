(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Shadows, Colony, Combat, Walls, Nests, Catalog } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Un village gardé ; la lumière loin.
  function world(beings, radius) {
    const state = State.create(17);
    const v = village(state, { radius: radius || 400, beings });
    state.stats.shadows = 5;
    state.player.x = -20000;
    return { state, v };
  }

  // --- Lumière ---

  test('le porte-bouclier attire les coups des ombres, et n’en encaisse que la moitié', () => {
    const { state } = world({ gardien: 1, bouclier: 1 });
    const game = Sim.create(state);
    const [g, b] = ['gardien', 'bouclier'].map((id) => game.colony.beings.find((x) => x.species === id));
    // L'ombre est plus près du gardien ; elle choisit pourtant le porte-bouclier.
    g.x = 100; g.y = 0;
    b.x = 220; b.y = 0;
    const s = Shadows.spawn(game, 'errante', 60, 0, 'tide');
    s.home = state.villages[0];
    s.retarget = 0;
    Sim.step(game, dt, Sim.emptyInput());
    assert.equal(s.target.ref, b);
    const hp = b.hp;
    Combat.hurtBeing(game, b, 20);
    assert.near(b.hp, hp - 10, 1e-9);
  });

  test('le lancier frappe de loin, et brise les ouvrages d’une base bien mieux qu’un gardien', () => {
    const lancier = Colony.species('lancier'), gardien = Colony.species('gardien');
    assert.ok(lancier.range > gardien.range * 2);
    const hits = (id) => {
      const { state } = world({ [id]: 1 });
      const nest = Nests.add(state, 2000, 0, CONFIG.nests.levelEvery * 3);
      const work = nest.buildings.find((x) => x.type === 'fleche');
      const hp = work.hp;
      Combat.setPosture(state, 'siege');
      const game = Sim.create(state);
      const b = game.colony.beings[0];
      b.x = work.x - 20;
      b.y = work.y;
      b.enemy = Nests.workTarget(nest, work);
      b.enemyCheck = 99;
      b.cd = 0;
      game.shadows.list.length = 0;
      for (let i = 0; i < 10; i++) Sim.step(game, dt, Sim.emptyInput());
      return hp - work.hp;
    };
    const a = hits('lancier'), b = hits('gardien');
    assert.ok(a > 0 && b > 0);
    assert.ok(a >= b * 4, `${a} contre ${b}`);
  });

  test('les nouvelles unités se recrutent comme les autres (caserne, échos), sous conditions', () => {
    const { state, v } = world({ gardien: 1 });
    state.light = state.totalLight = 1e7;
    state.echoes = 1e4;
    state.player.x = 0;
    assert.ok(Catalog.get('bouclier').revealed(state));
    assert.ok(!Catalog.get('lancier').revealed(state), 'le lancier attend la première base d’ombre');
    state.cleared.push('0,0');
    assert.ok(Catalog.get('lancier').revealed(state));
    assert.ok(Catalog.buy(state, 'bouclier'));
    assert.equal(v.beings.bouclier, 1);
  });

  // --- Ombres ---

  test('la fouisseuse passe sous les murailles ; une errante non', () => {
    const go = (kind) => {
      const { state, v } = world({}, 520);
      const w = Walls.plan(v);
      w.work = Walls.workOf(w);
      const game = Sim.create(state);
      const a = Vide.Plan.turn(v) + Math.PI / Vide.Plan.AVENUES;
      const r = Walls.radius(w);
      const s = Shadows.spawn(game, kind, Math.cos(a) * (r + 100), Math.sin(a) * (r + 100), 'tide');
      s.home = v;
      s.hp = 1e9;
      run(game, 10);
      return Math.hypot(s.x - v.x, s.y - v.y) - r;
    };
    assert.ok(go('fouisseuse') < -40, 'dessous');
    assert.ok(go('errante') > 0, 'arrêtée');
  });

  test('la bélière enfonce une muraille bien plus vite qu’une massive', () => {
    const breach = (kind) => {
      const { state, v } = world({}, 520);
      const w = Walls.plan(v);
      w.work = Walls.workOf(w);
      const game = Sim.create(state);
      const a = Vide.Plan.turn(v) + Math.PI / Vide.Plan.AVENUES;
      const r = Walls.radius(w);
      const s = Shadows.spawn(game, kind, Math.cos(a) * (r + 60), Math.sin(a) * (r + 60), 'tide');
      s.home = v;
      s.hp = 1e9;
      let t = 0;
      while (!w.broken.length && t < 300) {
        Sim.step(game, dt, Sim.emptyInput());
        t += dt;
      }
      return t;
    };
    const ram = breach('beliere'), heavy = breach('massive');
    assert.ok(ram < heavy / 2, `${ram.toFixed(1)} s contre ${heavy.toFixed(1)} s`);
  });

  test('la cracheuse frappe de loin', () => {
    const { state } = world({ gardien: 1 });
    const game = Sim.create(state);
    const g = game.colony.beings[0];
    g.x = 0; g.y = 0;
    const s = Shadows.spawn(game, 'cracheuse', 600, 0, 'tide');
    s.home = state.villages[0];
    let spat = null;
    for (let i = 0; i < 60 * 20 && !spat; i++) {
      g.x = 0; g.y = 0; g.vx = g.vy = 0;
      Sim.step(game, dt, Sim.emptyInput());
      spat = game.events.find((e) => e.type === 'darkBolt' && e.spit) || null;
    }
    assert.ok(spat, 'elle a craché');
    assert.ok(Math.hypot(spat.x - spat.tx, spat.y - spat.ty) > 120, 'de loin');
  });
})();
