(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Walls, Plan, Catalog, Combat, Expeditions, Offline, Save, Territory } = Vide;
  const dt = CONFIG.step;

  // Un village de rayon `radius` à l'origine, avec une enceinte achevée ; la lumière loin.
  function walled(radius, beings) {
    const state = State.create(12);
    const v = village(state, { radius: radius || 520, beings: beings || {} });
    const w = Walls.plan(v);
    w.work = Walls.workOf(w);
    state.player.x = 20000;
    return { state, v, w, r: Walls.radius(w) };
  }

  // Une direction au milieu d'un quart (loin des portes), et celle d'une porte.
  const wallAngle = (v) => Plan.turn(v) + Math.PI / Plan.AVENUES;
  const gateAngle = (v) => Plan.turn(v);
  const polar = (v, a, r) => ({ x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r });

  test('une enceinte se pose sur le boulevard le plus loin possible ; une autre quand le village a grandi', () => {
    const state = State.create(3);
    const small = village(state, { radius: 150 });
    assert.equal(Walls.nextRing(small), null);
    const v = village(state, { x: 5000, radius: 520 });
    const n = Walls.nextRing(v);
    assert.equal(n, Math.floor((520 * CONFIG.walls.reach) / Plan.STREET));
    assert.ok(Walls.insideShare(v, n * Plan.STREET) >= CONFIG.walls.inside);
    Walls.plan(v);
    assert.equal(Walls.nextRing(v), null, 'pas de deuxième couche dans un si petit village');
    v.area = Math.PI * 900 * 900;
    v.cells = [];
    Territory.grow(v);
    assert.ok(Walls.nextRing(v) >= n + CONFIG.walls.layerGap);
    // Son prix : sa longueur.
    assert.equal(Walls.cost(4).light, Math.ceil(CONFIG.walls.costPerUnit * 2 * Math.PI * 4 * Plan.STREET));
    assert.ok(Walls.cost(6).light > Walls.cost(4).light);
  });

  test('l’enceinte s’achète dans un village, et ses bâtisseurs la montent en faisant le tour du cœur', () => {
    const state = State.create(5);
    const v = village(state, { radius: 520, beings: { lueur: 2 } });
    state.light = state.totalLight = 1e7;
    state.stats.shadows = 3;
    const item = Catalog.get('enceinte');
    state.player.x = 3000;
    assert.equal(item.blocked(state), 'rejoins un village');
    state.player.x = 0;
    assert.equal(item.blocked(state), 'il faut un bâtisseur');
    v.beings.batisseur = 2;
    assert.equal(item.blocked(state), null);
    assert.ok(Catalog.buy(state, 'enceinte'));
    assert.equal(item.blocked(state), 'une enceinte en chantier');
    const w = v.walls[0];
    state.player.x = 20000;
    const game = Sim.create(state);
    let done = false;
    for (let i = 0; i < Math.round((Walls.workOf(w) / 2 + 60) / dt) && !done; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      done = game.events.some((e) => e.type === 'wallDone');
    }
    assert.ok(done && Walls.isDone(w), `travail ${Math.round(w.work)} / ${Math.round(Walls.workOf(w))}`);
  });

  test('la lumière bute sur le mur, et passe par la porte', () => {
    const go = (angle) => {
      const { state, v, r } = walled();
      const p = polar(v, angle, r - 60);
      state.player.x = p.x;
      state.player.y = p.y;
      const game = Sim.create(state);
      const input = Sim.emptyInput();
      for (let i = 0; i < 60 * 3; i++) {
        input.move.x = Math.cos(angle);
        input.move.y = Math.sin(angle);
        Sim.step(game, dt, input);
      }
      return Math.hypot(state.player.x - v.x, state.player.y - v.y) - r;
    };
    const { v } = walled();
    assert.ok(go(wallAngle(v)) < -CONFIG.walls.thickness / 2, 'arrêtée par le mur');
    assert.ok(go(gateAngle(v)) > 100, 'passée par la porte');
  });

  test('une ombre bute même sur une porte ; elle frappe le pan, et passe par la brèche', () => {
    const run = (angle, prepare) => {
      const { state, v, w, r } = walled();
      const game = Sim.create(state);
      const p = polar(v, angle, r + 120);
      const s = Vide.Shadows.spawn(game, 'massive', p.x, p.y, 'tide');
      s.home = v;
      s.hp = s.maxHp = 1e9;
      if (prepare) prepare(game, v, w);
      for (let i = 0; i < 60 * 8; i++) Sim.step(game, dt, Sim.emptyInput());
      return { d: Math.hypot(s.x - v.x, s.y - v.y) - r, game, v, w, s };
    };
    const { v } = walled();
    const atWall = run(wallAngle(v));
    assert.ok(atWall.d > 0, 'arrêtée dehors');
    const seg = Walls.segmentAt(atWall.v, atWall.w, wallAngle(v));
    assert.ok(Walls.hp(atWall.game, atWall.v, atWall.w, seg) < CONFIG.walls.hp, 'le pan est frappé');
    assert.ok(run(gateAngle(v)).d > 0, 'la porte ne s’ouvre pas aux ombres');
    const breached = run(wallAngle(v), (game, vv, w) => {
      assert.ok(Walls.damage(game, vv, w, Walls.segmentAt(vv, w, wallAngle(vv)), CONFIG.walls.hp));
    });
    assert.ok(breached.d < -CONFIG.walls.thickness * 2, `entrée par la brèche (${Math.round(breached.d)})`);
  });

  test('une ombre finit par abattre un pan, et les bâtisseurs relèvent la brèche', () => {
    const { state, v, w } = walled(520, { batisseur: 2 });
    const game = Sim.create(state);
    const seg = Walls.segmentAt(v, w, wallAngle(v));
    let broke = false;
    for (let k = 0; k < 200 && !broke; k++) broke = Walls.damage(game, v, w, seg, 50);
    assert.ok(broke);
    assert.deepEqual(w.broken, [seg]);
    assert.equal(Walls.hp(game, v, w, seg), 0);
    let repaired = false;
    for (let i = 0; i < 60 * 240 && !repaired; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      repaired = game.events.some((e) => e.type === 'wallRepaired');
    }
    assert.ok(repaired);
    assert.deepEqual(w.broken, []);
  });

  test('les êtres passent par les portes : l’escorte rejoint la lumière dehors sans jamais traverser un pan', () => {
    const { state, v, r } = walled(520, { gardien: 3 });
    Combat.setPosture(state, 'escorte');
    const out = polar(v, wallAngle(v), r + 260);
    state.player.x = out.x;
    state.player.y = out.y;
    const game = Sim.create(state);
    const last = new Map();
    let crossed = 0, wrong = 0;
    for (let i = 0; i < 60 * 40; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      for (const b of game.colony.beings) {
        const d = Math.hypot(b.x - v.x, b.y - v.y);
        const before = last.get(b);
        if (before !== undefined && (before < r) !== (d < r)) {
          crossed++;
          if (!Walls.isGate(v, game.state.villages[0].walls[0], Math.atan2(b.y - v.y, b.x - v.x))) wrong++;
        }
        last.set(b, d);
      }
    }
    assert.ok(crossed >= 3, `passages : ${crossed}`);
    assert.equal(wrong, 0);
    for (const b of game.colony.beings) assert.ok(Math.hypot(b.x - out.x, b.y - out.y) < 450, 'ils l’ont rejointe');
  });

  test('une expédition sort par une porte', () => {
    const { state, v, r } = walled(520, { lueur: 4, gardien: 2 });
    state.light = state.totalLight = 1e7;
    state.player.x = 0;
    state.player.y = 0;
    const to = polar(v, wallAngle(v), 2000);
    const exp = Expeditions.launch(state, 'scouts', to.x, to.y, {});
    assert.ok(exp);
    state.player.x = 20000;
    const game = Sim.create(state);
    let prev = Math.hypot(exp.x - v.x, exp.y - v.y);
    let passed = null;
    for (let i = 0; i < 60 * 40 && passed === null; i++) {
      game.shadows.list.length = 0;
      Sim.step(game, dt, Sim.emptyInput());
      const d = Math.hypot(exp.x - v.x, exp.y - v.y);
      if (prev < r && d >= r) passed = Math.atan2(exp.y - v.y, exp.x - v.x);
      prev = d;
    }
    assert.ok(passed !== null, 'elle est sortie');
    assert.ok(Walls.isGate(v, v.walls[0], passed), 'par une porte');
  });

  test('pendant l’absence, les bâtisseurs relèvent les brèches et avancent l’enceinte', () => {
    const state = State.create(7);
    const v = village(state, { radius: 900, beings: { batisseur: 2 } });
    const inner = { n: 3, work: 0, broken: [] };
    inner.work = Walls.workOf(inner);
    inner.broken.push(2, 5);
    v.walls.push(inner);
    const outer = Walls.plan(v);
    const report = Offline.apply(state, Walls.workOf(outer) / 2 + 60);
    assert.deepEqual(inner.broken, []);
    assert.ok(Walls.isDone(outer));
    assert.equal(report.walls, 1);
  });

  test('sauvegarde : les enceintes et leurs brèches se gardent ; les anciennes parties n’en ont pas', () => {
    const { state, v, w } = walled();
    w.broken.push(3);
    const half = { n: 7, work: 10, broken: [1] };
    v.walls.push(half);
    const back = Save.deserialize(Save.serialize(state, 1)).state.villages[0].walls;
    assert.deepEqual(back, [{ n: w.n, work: w.work, broken: [3] }, { n: 7, work: 10, broken: [] }]);
    const old = JSON.parse(Save.serialize(state, 1));
    old.format = 20;
    delete old.state.villages[0].walls;
    assert.deepEqual(Save.deserialize(JSON.stringify(old)).state.villages[0].walls, []);
    // Données abîmées : rien ne plante, rien d'invalide ne passe.
    old.format = Save.FORMAT;
    old.state.villages[0].walls = [null, 4, { n: 'x' }, { n: 2, work: 1e9, broken: [99, -1, 0, 0] }, { n: 2, work: 5 }, { n: 3, work: -1 }, { n: 5, work: 2, broken: [1] }];
    const clean = Save.deserialize(JSON.stringify(old)).state.villages[0].walls;
    assert.deepEqual(clean.map((x) => x.n), [2, 3], 'une seule en chantier, pas de doublon');
    assert.deepEqual(clean[0].broken, [0]);
    assert.equal(clean[0].work, Walls.workOf(clean[0]));
    assert.equal(clean[1].work, 0);
  });
})();
