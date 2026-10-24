(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Territory, Lore, LORE, Sim, Save } = Vide;

  test('chaque fragment a un identifiant unique et un texte', () => {
    const ids = new Set();
    for (const f of LORE) {
      assert.ok(!ids.has(f.id), `doublon : ${f.id}`);
      ids.add(f.id);
      assert.ok(f.text.length > 10 && typeof f.when === 'function', f.id);
    }
  });

  test('aucun fragment au tout début', () => {
    assert.deepEqual(Lore.check(State.create(1)), []);
  });

  test('les fragments se révèlent dans l’ordre de la progression, une seule fois', () => {
    const state = State.create(1);
    state.totalLight = 300;
    assert.deepEqual(Lore.check(state), ['eveil', 'souvenirs']);
    assert.deepEqual(Lore.check(state), []);
    VideTest.village(state);
    assert.deepEqual(Lore.check(state), ['foyer']);
    assert.deepEqual(state.lore, ['eveil', 'souvenirs', 'foyer']);
  });

  test('découvrir une zone révèle son fragment', () => {
    const state = State.create(1);
    state.zones.discovered.push('brume');
    assert.ok(Lore.check(state).includes('brume'));
  });

  test('tout révéler est possible (aucune condition impossible)', () => {
    const state = State.create(1);
    state.totalLight = 1e9;
    const v = VideTest.village(state, { radius: 700, beings: { lueur: 8, gardien: 6, batisseur: 1 } });
    v.buildings.push({ type: 'nid', x: 0, y: 100, work: 999 });
    state.stats.shadows = 20;
    state.zones.discovered = Vide.ZONES.map((z) => z.id);
    for (const d of Vide.COLOSSI) state.colossi[d.id] = 'tamed';
    state.renaissances = 1;
    state.cleared.push('4,4'); // un nid détruit
    Lore.check(state);
    assert.equal(state.lore.length, LORE.length);
  });

  test('la simulation annonce un fragment révélé', () => {
    const game = Sim.create(State.create(1));
    game.state.totalLight = 1;
    Sim.step(game, CONFIG.step, Sim.emptyInput());
    assert.ok(game.events.some((e) => e.type === 'lore' && e.id === 'eveil'));
  });

  test('une partie déjà avancée remplit son journal d’un coup, avec un seul message', () => {
    const state = State.create(1);
    state.totalLight = 1e6;
    VideTest.village(state);
    state.stats.shadows = 12;
    const game = Sim.create(state);
    assert.ok(state.lore.length > 2);
    assert.equal(game.events.filter((e) => e.type === 'lore').length, 0);
    assert.ok(game.events.some((e) => e.type === 'loreBatch' && e.count === state.lore.length));
  });

  test('une sauvegarde de la 0.7 (format 7) se charge, journal vide', () => {
    const result = Save.deserialize(JSON.stringify({ format: 7, state: {} }));
    assert.ok(result.ok);
    assert.deepEqual(result.state.lore, []);
  });

  test('le journal sauvegardé est nettoyé', () => {
    assert.deepEqual(Save.sanitize({ lore: ['foyer', 'invente', 'foyer', 3, 'eveil'] }).lore, ['foyer', 'eveil']);
  });
})();
