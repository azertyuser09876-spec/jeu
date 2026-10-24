(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Catalog, Sim, Abilities, Field, Save, Renaissance } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, input) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, input || Sim.emptyInput());
  }

  function withAbilities(levels) {
    const state = State.create(2);
    Object.assign(state.upgrades, levels);
    village(state, { radius: 200 });
    village(state, { x: 4000, radius: 200, type: 'bastion' });
    const game = Sim.create(state);
    game.field.particles.length = 0;
    return game;
  }

  test('les capacités s’achètent dans l’onglet lumière : trois niveaux, la recharge raccourcit', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e9;
    village(state);
    for (const id of ['dash', 'beacon', 'recall']) {
      assert.ok(Catalog.get(id).revealed(state), id);
      for (let k = 0; k < 3; k++) assert.ok(Catalog.buy(state, id), `${id} ${k}`);
      assert.equal(Catalog.buy(state, id), false, 'trois niveaux au plus');
    }
    assert.near(Abilities.cooldown(CONFIG.abilities.dashCooldown, 3), CONFIG.abilities.dashCooldown * 0.5625, 1e-9);
  });

  test('sans la capacité, rien ne se passe', () => {
    const game = withAbilities({});
    const input = Sim.emptyInput();
    input.dash = input.beacon = input.recall = true;
    run(game, 0.5, input);
    assert.equal(game.state.beacon, null);
    assert.equal(game.abilities.dash.cd, 0);
  });

  test('la ruée porte bien plus loin, protège, puis se recharge', () => {
    const travel = (dash) => {
      const game = withAbilities({ dash: 1 });
      game.state.player.x = 1000;
      const input = Sim.emptyInput();
      input.move.x = 1;
      run(game, 0.5, input);
      const x0 = game.state.player.x;
      input.dash = dash;
      Sim.step(game, dt, input);
      assert.equal(game.vitality.invulnerable > 0, dash);
      run(game, 0.3, input);
      return { d: game.state.player.x - x0, game };
    };
    const plain = travel(false), rush = travel(true);
    assert.ok(rush.d > plain.d * 2, `${rush.d} contre ${plain.d}`);
    assert.ok(rush.game.abilities.dash.cd > 0);
  });

  test('le fanal récolte seul la lumière de sa zone ; on la reprend en repassant, ou en le reposant', () => {
    const game = withAbilities({ beacon: 1 });
    const { state } = game;
    state.player.x = 1500;
    const input = Sim.emptyInput();
    input.beacon = true;
    Sim.step(game, dt, input);
    assert.deepEqual([state.beacon.x, state.beacon.y], [1500, 0]);
    state.player.x = 30000; // le joueur s'éloigne : le fanal récolte quand même
    const rate = Abilities.beaconRate(state, game.stats);
    assert.ok(rate > 0);
    run(game, 5);
    assert.near(state.beacon.light, rate * 5, rate * 0.1);
    // Pendant l'absence aussi.
    const kept0 = state.beacon.light;
    const report = Vide.Offline.apply(state, 600);
    assert.near(state.beacon.light - kept0, rate * 600, rate);
    assert.ok(report.beacon > 0);
    const light = state.light;
    const kept = state.beacon.light;
    state.player.x = 1500;
    Sim.step(game, dt, Sim.emptyInput());
    assert.near(state.light, light + kept, kept * 0.05 + 1);
    assert.equal(state.beacon.light, 0);
    // Reposer le fanal rend aussi ce qu'il gardait.
    state.beacon.light = 50;
    game.abilities.beacon.cd = 0;
    const before = state.light;
    input.beacon = true;
    state.player.x = 2000;
    Sim.step(game, dt, input);
    assert.ok(state.light >= before + 50);
    assert.equal(state.beacon.x, 2000);
  });

  test('le retour : une courte concentration, puis la lumière se rassemble au village le plus proche', () => {
    const game = withAbilities({ recall: 1 });
    const { state } = game;
    state.player.x = 3200;
    state.player.y = 900;
    const input = Sim.emptyInput();
    input.recall = true;
    Sim.step(game, dt, input);
    assert.ok(game.abilities.recall.channel > 0);
    run(game, CONFIG.abilities.recallChannel * 0.5);
    assert.equal(state.player.x !== 4000 || state.player.y !== 0, true, 'pas encore');
    run(game, CONFIG.abilities.recallChannel * 0.6);
    assert.equal(state.player.x, 4000);
    assert.equal(state.player.y, 0);
    const e = game.events.find((x) => x.type === 'recall');
    assert.ok(e && e.from.x !== 4000 && e.village === 'bastion');
    assert.ok(game.abilities.recall.cd > 0);
  });

  test('le fanal se sauvegarde, se nettoie ; migration ; renaissance', () => {
    const state = State.create(1);
    state.beacon = { x: 10, y: -20, light: 33 };
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state.beacon, state.beacon);
    assert.equal(Save.sanitize({ beacon: { x: NaN, y: 0 } }).beacon, null);
    assert.deepEqual(Save.sanitize({ beacon: { x: 1, y: 2, light: -5 } }).beacon, { x: 1, y: 2, light: 0 });
    assert.equal(Save.deserialize(JSON.stringify({ format: 15, state: {} })).state.beacon, null);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.equal(state.beacon, null);
  });
})();
