(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Villages, Catalog, Sim, Colony, Structures, Steward, Offline, Save } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  test('l’intendant garde sa part de ce que produit son village ; le reste revient au joueur', () => {
    const state = State.create(1);
    const v = village(state, { radius: 300 });
    v.steward = 0.25;
    state.player.x = 50000; // le joueur ne récolte rien lui-même
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, 10);
    assert.ok(v.funds > 0);
    assert.near(v.funds, (state.light + v.funds) * 0.25, 1e-6);
    assert.near(state.totalLight, state.light + v.funds, 1e-6, 'la part confiée compte comme lumière récoltée');
  });

  test('la part confiée se règle dans la boutique du village : 0, 10, 25, 50 %, puis 0', () => {
    const state = State.create(1);
    const v = village(state, { beings: { lueur: 1 } });
    assert.ok(Catalog.get('intendant').revealed(state));
    const seen = [];
    for (let i = 0; i < 4; i++) {
      assert.ok(Catalog.buy(state, 'intendant'));
      seen.push(v.steward);
    }
    assert.deepEqual(seen, [0.1, 0.25, 0.5, 0]);
    assert.equal(Catalog.get('intendant').label(state), '0 %');
    state.player.x = 5000;
    assert.equal(Catalog.get('intendant').blocked(state), 'rejoins un village');
  });

  test('avec sa réserve, l’intendant éveille des lueurs, puis un bâtisseur et des logis quand c’est plein', () => {
    const state = State.create(1);
    const v = village(state, { radius: 300 });
    const cap = Villages.local(state, v).beingCap;
    v.funds = 1e9;
    const bought = Steward.catchUp(state, v, 30).map((w) => w.id);
    assert.equal(v.beings.lueur, cap, 'la population se remplit');
    assert.ok(v.beings.batisseur >= 1);
    assert.ok(bought.includes('nid'), 'un logis est planifié quand la population est pleine');
    assert.ok(bought.indexOf('nid') > bought.indexOf('batisseur'));
  });

  test('l’intendant ne paie qu’en lumière, et pas plus que sa réserve', () => {
    const state = State.create(1);
    const v = village(state, { radius: 400, beings: { batisseur: 1 } });
    state.stats.shadows = 5; // l'armée et les tours seraient disponibles
    v.funds = 1e12;
    for (const w of Steward.catchUp(state, v, 100)) {
      assert.ok(!Colony.species(w.kind === 'being' ? w.id : 'lueur').army);
      assert.ok(w.id !== 'tour');
    }
    const poor = village(state, { x: 5000 });
    poor.funds = 10;
    assert.equal(Steward.act(state, poor), null);
    assert.equal(poor.funds, 10);
  });

  test('un village confié grandit seul, sans plafond fixe de population', () => {
    const state = State.create(2);
    const v = village(state, { radius: 350, beings: { batisseur: 1 } });
    v.steward = 0.5;
    v.funds = 5e6;
    state.player.x = 50000;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, 240);
    const cap = Villages.local(state, v).beingCap;
    assert.ok(cap > CONFIG.colony.cap, `plafond ${cap}`);
    assert.ok(Colony.populationIn(v) > CONFIG.colony.cap, `population ${Colony.populationIn(v)}`);
    assert.ok(game.events.some((e) => e.type === 'steward') || Structures.countIn(v, 'nid') > 0);
  });

  test('pendant l’absence, l’intendant met de côté puis dépense sa réserve', () => {
    const state = State.create(1);
    const v = village(state, { radius: 300, beings: { lueur: 1 } });
    v.steward = 0.5;
    v.rate = 20;
    const report = Offline.apply(state, 2 * 3600);
    assert.ok(report.kept > 0);
    assert.ok(report.steward.length > 0, 'il a fait quelque chose');
    assert.near(state.totalLight, report.light + report.kept, 1e-3);
  });

  test('migration et nettoyage : intendant inactif par défaut, part et réserve abîmées corrigées', () => {
    const old = { format: 10, state: { villages: [{ id: 1, type: 'atelier', x: 0, y: 0, area: 3e4 }] } };
    const v = Save.deserialize(JSON.stringify(old)).state.villages[0];
    assert.equal(v.steward, 0);
    assert.equal(v.funds, 0);
    const bad = Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, steward: 0.7, funds: -3 }] }).villages[0];
    assert.equal(bad.steward, 0);
    assert.equal(bad.funds, 0);
    const good = Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, steward: 0.25, funds: 900 }] }).villages[0];
    assert.equal(good.steward, 0.25);
    assert.equal(good.funds, 900);
  });
})();
