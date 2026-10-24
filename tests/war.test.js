(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Nests, War, Offline, Save, Renaissance, Structures } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Un village et, à 5 000, une base mûre prête à essaimer ; la lumière loin.
  function world(age) {
    const state = State.create(21);
    const v = village(state, { radius: 350, beings: { lueur: 4 } });
    const base = Nests.add(state, 5000, 0, age === undefined ? CONFIG.nests.levelEvery * 3 : age);
    state.player.x = -6000;
    return { state, v, base };
  }

  test('une base mûre essaime un avant-poste vers ton village ; le premier ouvre la guerre', () => {
    const { state, v, base } = world();
    base.swarm = 1;
    const game = Sim.create(state);
    assert.equal(state.war, null);
    run(game, 1.5);
    assert.equal(state.nests.length, 2);
    const outpost = state.nests[1];
    assert.equal(outpost.parent, base.id);
    // Entre la base et le village, à bonne distance de lui ; plus petit qu'une base.
    const d = Math.hypot(outpost.x - base.x, outpost.y - base.y);
    assert.ok(d >= CONFIG.nests.outpostDistance[0] - 1 && d <= CONFIG.nests.outpostDistance[1] + 1);
    assert.ok(Math.hypot(outpost.x - v.x, outpost.y - v.y) < Math.hypot(base.x - v.x, base.y - v.y));
    assert.ok(Nests.radius(outpost) < Nests.radius({ age: outpost.age, parent: null }));
    assert.ok(state.war, 'la guerre est ouverte');
    assert.equal(War.phase(state), 'tension');
    assert.ok(game.events.some((e) => e.type === 'outpost' && e.first));
    assert.ok(game.events.some((e) => e.type === 'war'));
    // Un avant-poste n'essaime pas ; une jeune base non plus ; au plus deux avant-postes par base.
    assert.equal(Nests.swarm(state, outpost, 1e9), null);
    assert.equal(Nests.swarm(state, Nests.add(state, -5000, 0, 0), 1e9), null);
    assert.ok(Nests.swarm(state, base, 1e9));
    assert.equal(Nests.swarm(state, base, 1e9), null);
  });

  test('pendant la tension, un avant-poste n’envoie que des rôdeuses, qui tournent sans attaquer puis s’en vont', () => {
    const { state, v } = world();
    v.beings.batisseur = 1;
    const b = Structures.plan(state, v, 'nid');
    b.work = Structures.def('nid').work;
    const outpost = Nests.spawnOutpost(state, state.nests[0]);
    War.begin(state);
    const game = Sim.create(state);
    const count = Nests.raid(game, outpost);
    assert.equal(count, CONFIG.war.prowlers);
    const prowlers = game.shadows.list.filter((s) => s.calm);
    assert.equal(prowlers.length, count);
    // Elles viennent jusqu'au village (on les y pose), y tournent, ne frappent rien.
    for (const s of prowlers) {
      s.x = v.x + 500;
      s.y = v.y;
    }
    let hits = 0;
    for (let i = 0; i < Math.round(CONFIG.war.prowlTime / dt) + 60; i++) {
      game.vitality.invulnerable = 1;
      // (Seules les rôdeuses : ni raid de la base mère, ni marée.)
      const list = game.shadows.list;
      for (let k = list.length - 1; k >= 0; k--) if (!list[k].calm) list.splice(k, 1);
      Sim.step(game, dt, Sim.emptyInput());
      hits += game.events.filter((e) => e.type === 'broken' || e.type === 'beingDown' || e.type === 'heartAttacked').length;
      game.events.length = 0;
    }
    assert.equal(hits, 0);
    assert.ok(game.colony.beings.every((x) => x.hp === null || x.hp >= Vide.Colony.maxHp(game, x)));
    assert.equal(game.shadows.list.filter((s) => s.calm).length, 0, 'elles sont parties');
  });

  test('la guerre se durcit : âpre, puis rude ; les avant-postes lancent de vrais raids, plus gros, plus souvent', () => {
    const { state } = world();
    const outpost = Nests.spawnOutpost(state, state.nests[0]);
    War.begin(state);
    assert.ok(War.calm(state));
    assert.ok(War.raidScale(state) < 1);
    state.war.age = CONFIG.war.ramp * 0.4;
    assert.equal(War.phase(state), 'âpre');
    assert.ok(!War.calm(state));
    const game = Sim.create(state);
    Nests.raid(game, outpost);
    assert.ok(game.shadows.list.some((s) => !s.calm), 'un vrai raid');
    state.war.age = CONFIG.war.ramp * 2;
    assert.equal(War.phase(state), 'rude');
    assert.equal(War.intensity(state), 1);
    assert.equal(War.raidScale(state), CONFIG.war.raidTo);
    assert.equal(War.pace(state), 1 + CONFIG.war.pace);
  });

  test('pendant l’absence, tout est possible : des avant-postes naissent, la guerre s’ouvre et mûrit', () => {
    const { state } = world();
    const report = Offline.apply(state, 3 * 3600);
    assert.ok(report.outposts >= 1);
    assert.equal(report.war, true);
    assert.ok(state.war.age > 3600);
    assert.equal(War.phase(state), 'rude');
    assert.ok(state.nests.some((n) => n.parent));
  });

  test('sauvegarde : la guerre et les avant-postes se gardent ; les anciennes parties n’en ont pas ; renaissance', () => {
    const { state } = world();
    const outpost = Nests.spawnOutpost(state, state.nests[0]);
    War.begin(state);
    state.war.age = 123;
    const back = Save.deserialize(Save.serialize(state, 1)).state;
    assert.deepEqual(back.war, { age: 123 });
    assert.equal(back.nests[1].parent, outpost.parent);
    const old = JSON.parse(Save.serialize(state, 1));
    old.format = 22;
    delete old.state.war;
    for (const n of old.state.nests) {
      delete n.parent;
      delete n.swarm;
    }
    const migrated = Save.deserialize(JSON.stringify(old)).state;
    assert.equal(migrated.war, null);
    assert.ok(migrated.nests.every((n) => n.parent === null && n.swarm === CONFIG.nests.outpostEvery));
    const bad = Save.sanitize({ war: { age: -4 }, nests: [{ id: 3, x: 0, y: 0, parent: 3, swarm: 'x' }] });
    assert.deepEqual(bad.war, { age: 0 });
    assert.equal(bad.nests[0].parent, null);
    assert.equal(bad.nests[0].swarm, CONFIG.nests.outpostEvery);
    assert.equal(Save.sanitize({ war: 'oui' }).war, null);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.equal(state.war, null);
  });
})();
