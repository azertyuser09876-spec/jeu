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
    // (La force d'un raid : le poids de ses ombres, les plus grosses comptant davantage.)
    const weight = () => game.shadows.list.reduce((sum, s) => sum + Vide.Shadows.kind(s.kind).cost, 0);
    assert.ok(Nests.raid(game, nest) >= 2);
    const small = weight();
    for (const s of game.shadows.list) assert.equal(s.home, state.villages[1]);
    assert.ok(game.events.some((e) => e.type === 'raid'));
    game.shadows.list.length = 0;
    nest.age = CONFIG.nests.levelEvery * 5;
    Nests.raid(game, nest);
    assert.ok(weight() > small);
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

  // --- Des bases ---

  test('une base a un territoire de noirceur qui grandit avec l’âge, mûrit en nuances, et n’empiète jamais sur un village', () => {
    const state = State.create(8);
    const v = village(state, { radius: 300 });
    const nest = Nests.add(state, 1100, 0, 0);
    assert.ok(nest.cells.length > 0 && nest.dark);
    assert.ok(Nests.darkAt(state, nest.x, nest.y) === nest);
    assert.equal(Nests.darkAt(state, v.x, v.y), null);
    const cells0 = nest.cells.length;
    const game = Sim.create(state);
    state.player.x = -5000;
    for (let i = 0; i < 4; i++) {
      nest.age += CONFIG.nests.levelEvery * 2;
      v.area *= 1.8;
      run(game, 2);
    }
    assert.ok(nest.cells.length > cells0, 'elle a grandi');
    // Ni elle ni le village n'empiètent l'un sur l'autre, même en grandissant tous deux.
    for (let k = 0; k < nest.cells.length; k += 3) assert.ok(!Territory.has(v, nest.cells[k], nest.cells[k + 1]));
    // Sa noirceur mûrit, nuance après nuance, jusqu'au noir pur à son cœur.
    Offline.apply(state, 4 * 3600);
    const heart = nest.cells[2];
    assert.equal(heart, 100);
    assert.ok(Territory.nuance(heart) === Territory.NUANCES.length);
  });

  test('elle bâtit avec l’âge : fosses, flèches, puis un rempart d’ombre ; ses fosses grossissent ses raids', () => {
    const state = State.create(8);
    village(state, { radius: 300 });
    const young = Nests.add(state, 2500, 0, 0);
    assert.equal(young.buildings.length, 0);
    const old = Nests.add(state, -3500, 0, CONFIG.nests.levelEvery * 7);
    const count = (t) => old.buildings.filter((b) => b.type === t).length;
    assert.equal(count('fosse'), Nests.allowed(old, Vide.darkWork('fosse')));
    assert.equal(count('fleche'), Nests.allowed(old, Vide.darkWork('fleche')));
    assert.ok(count('fosse') >= 2 && count('fleche') >= 3);
    assert.equal(old.walls.length, 1);
    assert.ok(Vide.Walls.isDone(old.walls[0]));
    // Sur son plan : défense près des avenues, fosses plus près du cœur.
    const mean = (t) => old.buildings.filter((b) => b.type === t).reduce((m, b) => m + Math.hypot(b.x - old.x, b.y - old.y), 0) / count(t);
    assert.ok(mean('fosse') < mean('fleche'));
    assert.ok(Nests.bonus(old, 'raid') > 0);
    // La jeune base bâtit au fil du temps (et pendant l'absence).
    Offline.apply(state, CONFIG.nests.levelEvery * 3);
    assert.ok(young.buildings.length > 0);
  });

  test('ses flèches tirent sur la lumière à leur portée', () => {
    const state = State.create(8);
    village(state, { radius: 300 });
    const nest = Nests.add(state, 3000, 0, CONFIG.nests.levelEvery * 4);
    const fleche = nest.buildings.find((b) => b.type === 'fleche');
    state.player.x = fleche.x + 100;
    state.player.y = fleche.y;
    const game = Sim.create(state);
    const hp = game.vitality.hp;
    run(game, 1);
    assert.ok(game.vitality.hp < hp, 'touchée');
    assert.ok(game.events.some((e) => e.type === 'darkBolt'));
  });

  test('un rempart d’ombre arrête la lumière (les ombres le traversent) ; l’armée en siège l’abat, puis les ouvrages, puis le cœur', () => {
    const state = State.create(8);
    village(state, { radius: 300, beings: { gardien: 10, etincelle: 6 } });
    const nest = Nests.add(state, 1700, 0, CONFIG.nests.levelEvery * 4);
    const wall = nest.walls[0];
    assert.ok(wall && Vide.Walls.isDone(wall));
    const r = Vide.Walls.radius(wall);
    // La lumière, de l'extérieur, bute dessus.
    const game0 = Sim.create(state);
    state.player.x = nest.x - r - 80;
    state.player.y = nest.y;
    game0.vitality.invulnerable = 1e9;
    const input = Sim.emptyInput();
    input.move.x = 1;
    for (let i = 0; i < 60 * 2; i++) Sim.step(game0, dt, input);
    assert.ok(nest.x - state.player.x > r, 'arrêtée dehors');
    // Une ombre le traverse.
    const s = Vide.Shadows.spawn(game0, 'errante', nest.x, nest.y, 'roam');
    s.home = state.villages[0];
    s.hp = 1e9;
    for (let i = 0; i < 60 * 12; i++) Sim.step(game0, dt, Sim.emptyInput());
    assert.ok(Math.hypot(s.x - nest.x, s.y - nest.y) > r + 20, 'sortie sans brèche');
    assert.equal(wall.broken.length, 0);

    // Le siège.
    Vide.Combat.setPosture(state, 'siege');
    state.player.x = -3000;
    state.player.y = 0;
    state.upgrades.edge = 8;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    let breach = false, works = 0;
    for (let i = 0; i < 60 * 240 && state.nests.length; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      breach = breach || game.events.some((e) => e.type === 'darkBreach');
      works += game.events.filter((e) => e.type === 'workDown').length;
      game.events.length = 0;
    }
    assert.ok(breach, 'une brèche dans le rempart');
    assert.ok(works > 0, 'des ouvrages abattus');
    assert.equal(state.nests.length, 0, 'la base est tombée');
  });

  test('nids sauvegardés : relus, nettoyés ; migration ; renaissance', () => {
    const state = twoVillages();
    Nests.add(state, 4000, 0, 600, '3,-2');
    state.cleared.push('1,1');
    state.nestTimer = 42;
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state, state);
    // Une base mûre (territoire, ouvrages, rempart) se garde telle quelle.
    const mature = Nests.add(state, -5000, 0, CONFIG.nests.levelEvery * 5);
    const back = Save.deserialize(Save.serialize(state, 1)).state.nests.find((n) => n.id === mature.id);
    assert.deepEqual([back.cells, back.buildings, back.walls, back.area], [mature.cells, mature.buildings, mature.walls, mature.area]);
    state.nests.pop();
    // Une ancienne base (format 21) retrouve son territoire au chargement, et bâtit sans tarder.
    const before = JSON.parse(Save.serialize(state, 1));
    before.format = 21;
    for (const n of before.state.nests) {
      delete n.cells;
      delete n.buildings;
      delete n.walls;
      delete n.build;
    }
    const migrated = Save.deserialize(JSON.stringify(before)).state.nests[0];
    assert.ok(migrated.cells.length > 0 && migrated.dark);
    assert.equal(migrated.build, 0);
    const bad = Save.sanitize({
      nests: [{ id: 1, x: 0, y: 0, hp: 1e9, age: -5, buildings: [{ type: 'fosse', x: 1, y: 2, hp: 1e9 }, { type: '?', x: 0, y: 0 }, 4], walls: [{ n: 2, work: 1e9 }, 'x'], cells: 'non', area: 1e12 },
        { id: 1, x: 5, y: 5 }, { id: 2, x: NaN, y: 0 }, 'x'],
      cleared: ['1,1', '1,1', 'abc', 3], nestTimer: 'bientôt',
    });
    assert.equal(bad.nests.length, 1);
    assert.equal(bad.nests[0].hp, CONFIG.nests.hp);
    assert.equal(bad.nests[0].age, 0);
    assert.deepEqual(bad.nests[0].buildings, [{ type: 'fosse', x: 1, y: 2, hp: Vide.darkWork('fosse').hp }]);
    assert.equal(bad.nests[0].walls.length, 1);
    assert.ok(bad.nests[0].area <= Math.PI * 4 * Nests.radius(bad.nests[0]) ** 2);
    assert.ok(bad.nests[0].cells.length > 0);
    assert.deepEqual(bad.cleared, ['1,1']);
    assert.equal(bad.nestTimer, null);
    const old = Save.deserialize(JSON.stringify({ format: 16, state: {} })).state;
    assert.deepEqual([old.nests, old.cleared, old.nestTimer], [[], [], null]);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.deepEqual(state.nests, []);
    assert.deepEqual(state.cleared, ['1,1'], 'les régions libérées le restent');
  });

  // --- Siège ---

  test('en siège, l’armée va au nid le plus proche, disperse ses défenseurs et abat son cœur', () => {
    const state = State.create(8);
    village(state, { radius: 300, beings: { gardien: 6, etincelle: 4 } });
    const nest = Nests.add(state, 1400, 0, 0);
    Vide.Combat.setPosture(state, 'siege');
    state.player.x = -3000;
    state.upgrades.edge = 6; // une armée aguerrie
    const game = Sim.create(state);
    game.field.particles.length = 0;
    const echoes = state.echoes;
    let defended = false;
    for (let i = 0; i < 60 * 120 && state.nests.length; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      defended = defended || game.shadows.list.some((x) => Math.hypot(x.x - nest.x, x.y - nest.y) < 200);
    }
    assert.equal(state.nests.length, 0, 'le nid est tombé');
    assert.ok(defended, 'il s’est défendu');
    assert.ok(state.echoes > echoes + CONFIG.nests.echoes * 0.9);
    assert.equal(state.cleared.length, 1);
    assert.ok(game.events.some((e) => e.type === 'nestDestroyed' && e.first));
  });

  test('sans nid à portée, une armée en siège garde son village', () => {
    const state = State.create(8);
    const v = village(state, { radius: 300, beings: { gardien: 1 } });
    Vide.Combat.setPosture(state, 'siege');
    const game = Sim.create(state);
    const a = Vide.Combat.anchor(game, game.colony.beings[0]);
    assert.equal(a.x, v.x);
    assert.equal(a.nest, undefined);
  });

  test('la pulsation blesse le cœur d’un nid, une fois par onde', () => {
    const state = twoVillages();
    const game = Sim.create(state);
    const nest = Nests.add(state, 5000, 0, 0);
    state.player.x = 5060;
    Sim.pulse(game);
    run(game, 1);
    const hp = Nests.maxHp(nest) - game.stats.pulseDamage * 2;
    assert.near(nest.hp, hp, CONFIG.nests.regen * 1.1);
  });

  test('une région libérée (clairière) fait naître plus de lumière', () => {
    const state = twoVillages();
    const game = Sim.create(state);
    const key = game.region.key;
    const before = game.region.zone.density;
    state.cleared.push(key);
    // (zoneMods est interne : on vérifie par le nombre de particules visé autour du joueur.)
    game.field.particles.length = 0;
    run(game, CONFIG.field.refillTime * 1.5);
    const rich = game.field.particles.length;
    state.cleared.length = 0;
    game.field.particles.length = 0;
    run(game, CONFIG.field.refillTime * 1.5);
    assert.ok(rich > game.field.particles.length * 1.15, `${rich} contre ${game.field.particles.length} (densité ${before})`);
  });
})();
