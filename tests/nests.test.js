(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Nests, Zones, Territory, Offline, Save, Renaissance, util } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  function twoVillages() {
    const state = State.create(8);
    village(state, { radius: 250 });
    village(state, { x: 1800, radius: 250 });
    state.player.x = 900;
    return state;
  }

  test('après le deuxième village, un nid d’ombre naît à bonne distance ; puis d’autres, au plus six', () => {
    const one = State.create(8);
    village(one);
    const g1 = Sim.create(one);
    run(g1, CONFIG.nests.firstDelay + 5);
    assert.equal(one.nests.length, 0, 'un seul village : pas encore');

    const state = twoVillages();
    const game = Sim.create(state);
    run(game, CONFIG.nests.firstDelay + 1);
    assert.equal(state.nests.length, 1);
    const nest = state.nests[0];
    const d = Math.min(...state.villages.map((v) => Math.hypot(v.x - nest.x, v.y - nest.y) - Territory.radius(v)));
    assert.ok(d > CONFIG.nests.spawnDistance[0] * 0.7 - 1, `distance ${d}`);
    assert.ok(game.events.some((e) => e.type === 'nest' && e.first));
    state.nestTimer = 0;
    for (let k = 0; k < 10; k++) {
      state.nestTimer = 0;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(state.nests.length <= CONFIG.nests.max);
  });

  test('loin de l’origine, des régions dangereuses abritent déjà un nid, découvert en approchant', () => {
    const state = State.create(8);
    let found = null;
    for (let i = -8; i <= 8 && !found; i++) {
      for (let j = -8; j <= 8 && !found; j++) {
        const c = Zones.center(i, j, state.seed);
        const region = Zones.at(state.seed, c.x, c.y);
        if (Math.hypot(c.x, c.y) < CONFIG.nests.farFrom) continue;
        if (Nests.FAR_ZONES.includes(region.zone.id) && util.hash2(region.i, region.j, state.seed + 5309) <= CONFIG.nests.farChance) found = region;
      }
    }
    assert.ok(found, 'au moins une région qui en abrite un');
    const nest = Nests.discover(state, found);
    assert.ok(nest && Nests.level(nest) > 1, 'un nid déjà mûr');
    assert.equal(Nests.discover(state, found), null, 'une seule fois');
    state.nests.length = 0;
    state.cleared.push(found.key);
    assert.equal(Nests.discover(state, found), null, 'une région libérée le reste');
    const calm = Zones.at(state.seed, 0, 0);
    assert.equal(Nests.discover(state, calm), null);
  });

  test('l’obscurité épuise la lumière hors de tes territoires, et le vide y fait naître moins de lumière', () => {
    const state = twoVillages();
    const game = Sim.create(state);
    const nest = Nests.add(state, 6000, 0, 0);
    state.player.x = nest.x + 30;
    const hp = game.vitality.hp;
    run(game, 2);
    assert.ok(game.vitality.hp < hp - CONFIG.nests.drain);
    // Dans ton territoire, rien.
    nest.x = 0;
    state.player.x = 10;
    game.vitality.hp = hp;
    run(game, 2);
    assert.ok(game.vitality.hp >= hp - 0.01);
  });

  test('un nid lance des raids vers le village le plus proche, plus gros avec l’âge', () => {
    const state = twoVillages();
    const game = Sim.create(state);
    const nest = Nests.add(state, 4000, 0, 0);
    const small = Nests.raid(game, nest);
    assert.ok(small >= 2);
    for (const s of game.shadows.list) assert.equal(s.home, state.villages[1]);
    assert.ok(game.events.some((e) => e.type === 'raid'));
    game.shadows.list.length = 0;
    nest.age = CONFIG.nests.levelEvery * 5;
    assert.ok(Nests.raid(game, nest) > small);
    // Trop loin de tout village : aucun raid.
    const lone = Nests.add(state, 50000, 0, 0);
    assert.equal(Nests.raid(game, lone), 0);
  });

  test('avec l’âge, un nid grandit : niveau, obscurité, solidité ; il vieillit aussi pendant l’absence, sans raid', () => {
    const state = twoVillages();
    const nest = Nests.add(state, 4000, 0, 0);
    const r = Nests.radius(nest), hp = Nests.maxHp(nest);
    Offline.apply(state, 3600);
    assert.ok(Nests.level(nest) > 1);
    assert.ok(Nests.radius(nest) > r && Nests.maxHp(nest) > hp);
    assert.equal(Nests.level({ age: 1e9 }), CONFIG.nests.maxLevel);
  });

  test('nids sauvegardés : relus, nettoyés ; migration ; renaissance', () => {
    const state = twoVillages();
    Nests.add(state, 4000, 0, 600, '3,-2');
    state.cleared.push('1,1');
    state.nestTimer = 42;
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state, state);
    const bad = Save.sanitize({
      nests: [{ id: 1, x: 0, y: 0, hp: 1e9, age: -5 }, { id: 1, x: 5, y: 5 }, { id: 2, x: NaN, y: 0 }, 'x'],
      cleared: ['1,1', '1,1', 'abc', 3], nestTimer: 'bientôt',
    });
    assert.equal(bad.nests.length, 1);
    assert.equal(bad.nests[0].hp, CONFIG.nests.hp);
    assert.equal(bad.nests[0].age, 0);
    assert.deepEqual(bad.cleared, ['1,1']);
    assert.equal(bad.nestTimer, null);
    const old = Save.deserialize(JSON.stringify({ format: 16, state: {} })).state;
    assert.deepEqual([old.nests, old.cleared, old.nestTimer], [[], [], null]);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.deepEqual(state.nests, []);
    assert.deepEqual(state.cleared, ['1,1'], 'les régions libérées le restent');
  });
})();
