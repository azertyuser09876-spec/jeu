(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Nests, War, Fronts, Territory, util } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, each) {
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      Sim.step(game, dt, Sim.emptyInput());
      if (each) each();
    }
  }

  // Un village et, contre lui, une base mûre : leurs territoires se touchent.
  function front(beings) {
    const state = State.create(12);
    const v = village(state, { radius: 400, beings: beings || {} });
    const nest = Nests.add(state, 680, 0, CONFIG.nests.levelEvery * 4);
    state.player.x = -20000;
    return { state, v, nest };
  }

  const openWar = (state) => {
    War.begin(state);
    state.war.age = CONFIG.war.ramp;
  };

  test('un front : les cellules d’un village et d’une base qui se touchent', () => {
    const { state, v, nest } = front();
    const list = Fronts.contacts(v, nest);
    assert.ok(list.length > 3, `${list.length} contacts`);
    for (const c of list) {
      assert.ok(Territory.has(v, c.vi, c.vj) && Territory.has(nest, c.ni, c.nj));
      assert.equal(Math.abs(c.vi - c.ni) + Math.abs(c.vj - c.nj), 1);
    }
    const far = Nests.add(state, 9000, 0, 0);
    assert.equal(Fronts.contacts(v, far).length, 0);
  });

  test('en guerre ouverte, la noirceur d’une base rampe vers le village le plus proche jusqu’à le toucher', () => {
    const state = State.create(12);
    const v = village(state, { radius: 400 });
    const nest = Nests.add(state, 2600, 0, CONFIG.nests.levelEvery * 3);
    assert.equal(Fronts.contacts(v, nest).length, 0, 'loin');
    const rng = util.rng(4);
    for (let k = 0; k < 30; k++) Fronts.step(state, rng);
    assert.equal(Fronts.contacts(v, nest).length, 0, 'sans guerre, elle reste chez elle');
    openWar(state);
    const cells = nest.cells.length;
    let k = 0;
    while (!Fronts.contacts(v, nest).length && k++ < 3000) Fronts.step(state, rng);
    assert.ok(Fronts.contacts(v, nest).length > 0, 'au contact');
    assert.ok(nest.cells.length > cells);
    // Au contact, elle ne rampe plus.
    assert.equal(Fronts.creep(state, nest), null);
  });

  test('sans guerre ouverte, les ombres n’avancent pas ; en guerre, une base mord sur un village sans défense', () => {
    const { state, v, nest } = front();
    const rng = util.rng(5);
    const cells = v.cells.length / 3, area = v.area;
    for (let k = 0; k < 50; k++) Fronts.step(state, rng);
    assert.equal(v.cells.length / 3, cells, 'pas de guerre');
    War.begin(state);
    assert.equal(Fronts.darkPressure(state, nest), 0, 'la tension : pas encore');
    openWar(state);
    const darkCells = nest.cells.length / 3;
    let taken = 0;
    for (let k = 0; k < 50; k++) taken += Fronts.step(state, rng).filter((t) => t.side === 'shadow').length;
    assert.ok(taken > 3, `${taken} cellules prises`);
    assert.equal(v.cells.length / 3, cells - taken);
    assert.equal(nest.cells.length / 3, darkCells + taken);
    assert.near(v.area, area - taken * Territory.CELL ** 2, 1e-6, 'la surface (l’économie) suit');
    // Le cœur tient toujours.
    assert.ok(Territory.has(v, Territory.cellOf(v.x), Territory.cellOf(v.y)));
  });

  test('le blanc pur et la noirceur profonde tiennent le plus longtemps', () => {
    assert.ok(Fronts.yieldChance(100) < Fronts.yieldChance(0) * 0.2);
    // Un village au cœur blanchi perd ses cellules neuves d'abord.
    const { state, v } = front();
    openWar(state);
    for (let k = 0; k < v.cells.length; k += 3) v.cells[k + 2] = 100;
    const before = v.cells.length;
    const rng = util.rng(9);
    for (let k = 0; k < 40; k++) Fronts.step(state, rng);
    const lostWhite = (before - v.cells.length) / 3;
    const fresh = front();
    openWar(fresh.state);
    const rng2 = util.rng(9);
    for (let k = 0; k < 40; k++) Fronts.step(fresh.state, rng2);
    const lostFresh = (before - fresh.v.cells.length) / 3;
    assert.ok(lostWhite < lostFresh * 0.5, `${lostWhite} contre ${lostFresh}`);
  });

  test('des soldats repoussent le front ; un ouvrage sur une cellule reprise tombe, et laisse des échos', () => {
    const { state, v, nest } = front({ gardien: 12 });
    assert.ok(Fronts.lightPressure(state, v, nest) > 0);
    const game = Sim.create(state);
    // Un ouvrage au contact, sur la cellule la moins mûre (les autres : noirceur profonde).
    const c = Fronts.contacts(v, nest)[0];
    for (let k = 0; k < nest.cells.length; k += 3) {
      nest.cells[k + 2] = nest.cells[k] === c.ni && nest.cells[k + 1] === c.nj ? 0 : 100;
    }
    nest.buildings.push({ type: 'fosse', x: (c.ni + 0.5) * Territory.CELL, y: (c.nj + 0.5) * Territory.CELL, hp: 320 });
    const cells = v.cells.length;
    const seen = [];
    run(game, CONFIG.fronts.every * 30, () => {
      for (const e of game.events) if (e.type === 'front' || e.type === 'workDown') seen.push(e);
      game.events.length = 0;
    });
    assert.ok(v.cells.length > cells, 'du terrain gagné');
    assert.ok(seen.some((e) => e.type === 'front' && e.side === 'light'));
    const down = seen.find((e) => e.type === 'workDown');
    assert.ok(down && down.echoes > 0, 'l’ouvrage est tombé');
  });

  test('un bâtiment sur une cellule perdue tombe aux mains des ombres', () => {
    const { state, v, nest } = front();
    openWar(state);
    const c = Fronts.contacts(v, nest)[0];
    v.buildings.push({ type: 'prisme', x: (c.vi + 0.5) * Territory.CELL, y: (c.vj + 0.5) * Territory.CELL, work: 60 });
    const game = Sim.create(state);
    let lost = null;
    run(game, CONFIG.fronts.every * 60, () => {
      lost = lost || game.events.find((e) => e.type === 'structureLost') || null;
      game.events.length = 0;
    });
    assert.ok(lost, 'le prisme est perdu');
    assert.equal(lost.kind, 'prisme');
    assert.ok(!v.buildings.some((b) => b.type === 'prisme'));
  });
})();
