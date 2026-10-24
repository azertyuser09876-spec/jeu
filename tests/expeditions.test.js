(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Villages, Sim, Expeditions, Shadows, Offline, Save, Renaissance } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  function world() {
    const state = State.create(5);
    state.light = state.totalLight = 1e9;
    const home = village(state, { radius: 300, beings: { lueur: 5, gardien: 3 } });
    state.player.x = 300; // le joueur reste au village (les ombres errantes viennent vers lui ailleurs)
    return { state, home };
  }

  test('conditions : un village, des lueurs pour des colons, des gardiens pour l’escorte, ni trop près ni trop loin', () => {
    const empty = State.create(1);
    assert.equal(Expeditions.blocked(empty, 'scouts', 3000, 0), 'il faut un village');
    const { state, home } = world();
    assert.equal(Expeditions.blocked(state, 'scouts', 3000, 0), null);
    assert.equal(Expeditions.blocked(state, 'colons', 500, 0), 'trop près d’un village');
    assert.equal(Expeditions.blocked(state, 'colons', 3000, 0), null);
    assert.equal(Expeditions.blocked(state, 'scouts', 1e6, 0), 'trop loin');
    home.beings.lueur = 2;
    assert.ok(Expeditions.blocked(state, 'colons', 3000, 0).includes('lueurs'));
    home.beings.gardien = 1;
    assert.ok(Expeditions.blocked(state, 'scouts', 3000, 0, true).includes('gardiens'));
    state.light = 0;
    assert.equal(Expeditions.blocked(state, 'scouts', 3000, 0), 'pas assez de lumière');
  });

  test('des éclaireurs vont au but, révèlent les régions alentour, puis rentrent', () => {
    const { state } = world();
    const light = state.light;
    const exp = Expeditions.launch(state, 'scouts', 4000, 0);
    assert.ok(exp);
    assert.equal(state.light, light - Math.ceil(CONFIG.expeditions.scoutCost * 4000));
    const visited = state.zones.visited.length;
    const game = Sim.create(state);
    run(game, 4000 / CONFIG.expeditions.speed + 1);
    assert.ok(state.zones.visited.length > visited + 2, 'des régions révélées');
    assert.ok(game.events.some((e) => e.type === 'scouted'));
    assert.ok(exp.back);
    run(game, 4000 / CONFIG.expeditions.speed + 1);
    assert.equal(state.expeditions.length, 0);
    assert.ok(game.events.some((e) => e.type === 'returned'));
  });

  test('des colons (et leur escorte) fondent au but un village du type choisi', () => {
    const { state, home } = world();
    const price = Villages.foundCost(state);
    const exp = Expeditions.launch(state, 'colons', 2500, 400, { type: 'atelier', escort: true });
    assert.deepEqual(exp.members, { lueur: 3, gardien: 2 });
    assert.equal(home.beings.lueur, 2);
    assert.equal(home.beings.gardien, 1);
    assert.ok(Villages.foundCost(state) > price, 'les colons en route comptent dans le prix des fondations');
    const game = Sim.create(state);
    run(game, Math.hypot(2500, 400) / CONFIG.expeditions.speed + 1);
    assert.equal(state.villages.length, 2);
    const v = state.villages[1];
    assert.equal(v.type, 'atelier');
    assert.equal(v.x, 2500);
    assert.deepEqual(v.beings, { lueur: 3, gardien: 2 });
    assert.ok(game.events.some((e) => e.type === 'settled' && e.village === 'atelier'));
  });

  test('si la place est prise à leur arrivée, les colons rejoignent le village le plus proche', () => {
    const { state } = world();
    const exp = Expeditions.launch(state, 'colons', 2500, 0, { type: 'bastion' });
    const there = village(state, { x: 2600 });
    exp.x = 2490;
    const event = Expeditions.move(state, exp, 1);
    assert.equal(event.type, 'colonsJoined');
    assert.equal(there.beings.lueur, 3);
    assert.equal(state.villages.length, 2);
  });

  test('en chemin, les ombres les attaquent ; l’escorte se défend ; à bout de forces, l’expédition est perdue', () => {
    const { state } = world();
    const exp = Expeditions.launch(state, 'colons', 6000, 0, { escort: true });
    exp.x = 3000;
    const game = Sim.create(state);
    const s = Shadows.spawn(game, 'massive', 3040, 0, 'roam');
    s.near = exp;
    const hp = exp.hp;
    run(game, 3);
    assert.ok(exp.hp < hp || !state.expeditions.includes(exp), 'blessée');
    assert.ok(s.hp < s.maxHp, 'l’escorte a frappé');
    exp.hp = 1;
    exp.members.gardien = 0;
    const s2 = Shadows.spawn(game, 'errante', exp.x + 20, exp.y, 'roam');
    s2.near = exp;
    s2.cd = 0;
    run(game, 3);
    assert.equal(state.expeditions.includes(exp), false);
    assert.ok(game.events.some((e) => e.type === 'expeditionLost'));
  });

  test('pendant l’absence, elles marchent : les éclaireurs reviennent, les colons s’installent', () => {
    const { state } = world();
    Expeditions.launch(state, 'scouts', 3000, 0);
    Expeditions.launch(state, 'colons', -2500, 0, { type: 'sanctuaire' });
    const report = Offline.apply(state, 3600);
    assert.equal(state.expeditions.length, 0);
    assert.deepEqual(report.expeditions.map((e) => e.type).sort(), ['returned', 'scouted', 'settled']);
    assert.equal(state.villages[1].type, 'sanctuaire');
  });

  test('expéditions sauvegardées : relues, nettoyées ; migration ; renaissance', () => {
    const { state } = world();
    Expeditions.launch(state, 'colons', 3000, 0, { type: 'atelier', escort: true });
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state, state);
    const bad = Save.sanitize({ expeditions: [
      { id: 1, kind: 'colons', x: 0, y: 0, tx: 1, ty: 1, members: { lueur: 3, fantome: 2 }, hp: 1e9, type: 'temple' },
      { id: 2, kind: 'pirates', x: 0, y: 0, tx: 1, ty: 1, members: { lueur: 1 } },
      { id: 3, kind: 'scouts', x: NaN, y: 0, tx: 1, ty: 1, members: { eclaireur: 2 } },
      { id: 4, kind: 'scouts', x: 0, y: 0, tx: 1, ty: 1, members: {} }, 'x',
    ] });
    assert.equal(bad.expeditions.length, 1);
    assert.deepEqual(bad.expeditions[0].members, { lueur: 3 });
    assert.equal(bad.expeditions[0].type, 'jardins');
    assert.equal(bad.expeditions[0].hp, Expeditions.hpOf({ lueur: 3 }));
    const old = Save.deserialize(JSON.stringify({ format: 14, state: {} }));
    assert.deepEqual(old.state.expeditions, []);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.deepEqual(state.expeditions, []);
  });
})();
