(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Colossus, Allies, Expeditions, Roads, Structures, Offline } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Un village bâti ; la lumière loin de tout (elle ne provoque personne) ; le Veilleur dans l'état voulu.
  function world(status) {
    const state = State.create(31);
    const v = village(state, { radius: 400 });
    Structures.plan(state, v, 'nid');
    for (const b of v.buildings) b.work = Structures.def(b.type).work;
    state.stats.shadows = 15;
    if (status) state.colossi.veilleur = status;
    state.player.x = -30000;
    return { state, v };
  }

  // --- Marche sur un village ---

  test('un colosse rencontré finit par marcher sur ton village : il le piétine, puis s’en retourne', () => {
    const { state, v } = world('found');
    const game = Sim.create(state);
    const c = game.colossi[0];
    game.marchClock = 1;
    run(game, 1.1);
    assert.equal(c.mode, 'march');
    assert.ok(game.events.some((e) => e.type === 'march'));
    // Il arrive (on l'approche pour ne pas attendre sa longue marche).
    const a = Math.atan2(c.y - v.y, c.x - v.x);
    const d = Vide.Territory.radius(v) + Colossus.extent(c) * 0.2;
    c.x = v.x + Math.cos(a) * d;
    c.y = v.y + Math.sin(a) * d;
    let arrived = false, broken = false;
    for (let i = 0; i < Math.round((CONFIG.colossi.marchStay + 5) / dt); i++) {
      game.vitality.invulnerable = 1;
      Sim.step(game, dt, Sim.emptyInput());
      arrived = arrived || game.events.some((e) => e.type === 'rampage');
      broken = broken || v.buildings.some((b) => Structures.hp(game, b) < Structures.def(b.type).hp);
    }
    assert.ok(arrived, 'il piétine le village');
    assert.ok(broken, 'ses pas abîment les bâtiments');
    assert.equal(c.mode, 'roam', 'puis il s’en retourne');
    assert.ok(game.events.some((e) => e.type === 'colossusLeaves'));
  });

  test('il ne marche jamais pendant l’absence, ni s’il n’a pas été rencontré, ni apaisé', () => {
    for (const status of ['heard', 'tamed']) {
      const { state } = world(status);
      const game = Sim.create(state);
      game.marchClock = 0.5;
      run(game, 1);
      assert.ok(game.colossi[0].mode !== 'march', status);
    }
    const { state } = world('found');
    Offline.apply(state, 3 * 3600);
    const game = Sim.create(state);
    assert.ok(game.marchClock >= CONFIG.colossi.marchFirst - 1, 'l’horloge part du lancement de la partie');
  });

  test('en marche, l’armée du village le combat, et la lumière qui approche le détourne', () => {
    const { state, v } = world('found');
    const game = Sim.create(state);
    const c = game.colossi[0];
    Colossus.startMarch(game);
    c.x = v.x + 300;
    c.y = v.y;
    c.core.x = c.x;
    c.core.y = c.y;
    assert.ok(Colossus.target(game, v.x, v.y, 400), 'une cible pour l’armée');
    assert.ok(Colossus.hostile(c));
    state.player.x = c.x + 500;
    state.player.y = c.y;
    run(game, 0.2);
    assert.equal(c.mode, 'hunt');
    assert.equal(c.march, null);
  });

  // --- Rôles des colosses apaisés ---

  test('le Veilleur apaisé marche vers les ombres qui menacent un village et les écrase', () => {
    const { state, v } = world('tamed');
    const game = Sim.create(state);
    const c = game.colossi[0];
    const s = Vide.Shadows.spawn(game, 'massive', v.x - 600, v.y, 'tide');
    s.home = v;
    s.cd = 99;
    const d0 = Math.hypot(c.x - s.x, c.y - s.y);
    let crushed = false;
    for (let i = 0; i < 60 * 20 && !crushed; i++) {
      s.cd = 99;
      Sim.step(game, dt, Sim.emptyInput());
      crushed = !game.shadows.list.includes(s) || s.hp < s.maxHp;
    }
    assert.ok(crushed, `écrasée (il était à ${Math.round(d0)})`);
  });

  test('le Veilleur apaisé affronte un colosse en marche et le fait plier', () => {
    const { state } = world('tamed');
    state.colossi.tisseuse = 'found';
    const game = Sim.create(state);
    const guard = game.colossi.find((c) => c.id === 'veilleur');
    const foe = game.colossi.find((c) => c.id === 'tisseuse');
    Colossus.startMarch(game);
    assert.equal(foe.mode, 'march');
    foe.x = guard.x + 200;
    foe.y = guard.y;
    let staggered = false;
    for (let i = 0; i < 60 * 3; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      staggered = staggered || foe.stagger > 0 || foe.mode === 'kneel';
    }
    assert.ok(staggered);
    assert.ok(game.events.some((e) => e.type === 'guardClash'));
  });

  test('la Tisseuse apaisée tisse les routes en chantier', () => {
    const state = State.create(31);
    const a = village(state, { radius: 300 });
    const b = village(state, { x: 3000, radius: 300 });
    Roads.plan(state, a, b);
    state.colossi.veilleur = 'tamed';
    state.colossi.tisseuse = 'tamed';
    state.player.x = -30000;
    const game = Sim.create(state);
    const t = game.colossi.find((c) => c.id === 'tisseuse');
    // Elle part vers le front du chantier, puis tisse.
    const road = state.roads[0];
    t.x = 0;
    t.y = 0;
    run(game, 30);
    assert.ok(road.work > CONFIG.colossi.weave * 10, `tissé ${road.work}`);
    assert.equal(t.weaving, road);
    // Jusqu'au bout (les événements ne gardent que les cent derniers : on les lit à chaque pas).
    let woven = false;
    for (let i = 0; i < Math.round((Roads.length(state, road) / CONFIG.colossi.weave + 20) / dt); i++) {
      Sim.step(game, dt, Sim.emptyInput());
      woven = woven || game.events.some((e) => e.type === 'road' && e.woven);
    }
    assert.ok(Roads.isDone(state, road));
    assert.ok(woven);
  });

  test('le Léviathan apaisé emporte une expédition, plus vite et hors d’atteinte des ombres', () => {
    const trip = (tamed) => {
      const state = State.create(31);
      village(state, { radius: 300 });
      state.light = state.totalLight = 1e7;
      if (tamed) for (const id of ['veilleur', 'tisseuse', 'leviathan']) state.colossi[id] = 'tamed';
      state.player.x = -30000;
      const exp = Expeditions.launch(state, 'scouts', 9000, 0, {});
      const game = Sim.create(state);
      if (tamed) {
        const lev = game.colossi.find((c) => c.id === 'leviathan');
        lev.x = 200;
        lev.y = 0;
      }
      for (let i = 0; i < 60 * 20; i++) {
        game.shadows.list.length = 0;
        Sim.step(game, dt, Sim.emptyInput());
      }
      return { game, x: exp.x };
    };
    const walk = trip(false), ride = trip(true);
    assert.ok(ride.game.events.some((e) => e.type === 'carried'));
    assert.ok(ride.x > walk.x * 1.8, `${Math.round(ride.x)} contre ${Math.round(walk.x)}`);
    // Portée, une ombre ne l'arrête pas.
    const exp = ride.game.state.expeditions[0];
    assert.ok(Allies.carried(ride.game, exp));
    Vide.Shadows.spawn(ride.game, 'errante', exp.x + 20, exp.y, 'roam');
    const x0 = exp.x;
    Sim.step(ride.game, dt, Sim.emptyInput());
    assert.ok(exp.x > x0);
  });
})();
