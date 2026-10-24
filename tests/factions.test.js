(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Catalog, Factions, Villages, Nests, Save, Renaissance, Expeditions, Sim } = Vide;

  test('le joueur choisit la sous-faction de son premier village, avant de le fonder', () => {
    const state = State.create(3);
    state.light = state.totalLight = 1000;
    const items = Vide.FACTIONS.map((f) => Catalog.get('faction-' + f.id));
    assert.ok(items.every((i) => i.revealed(state)));
    assert.equal(Catalog.get('village-jardins').blocked(state), 'choisis ta sous-faction');
    assert.ok(Catalog.buy(state, 'faction-lames'));
    assert.equal(state.faction, 'lames');
    assert.ok(items.every((i) => !i.revealed(state)), 'le choix est fait');
    assert.ok(Catalog.buy(state, 'village-jardins'));
    assert.equal(state.villages[0].faction, 'lames');
  });

  test('un village fondé depuis un autre en hérite le plus souvent ; sinon il en prend une autre', () => {
    let same = 0;
    const N = 400;
    for (let id = 1; id <= N; id++) {
      const state = State.create(id);
      const f = Factions.inherit(state, 'eleveurs', Vide.FACTIONS, id + 1);
      assert.ok(Factions.isLight(f));
      if (f === 'eleveurs') same++;
    }
    assert.near(same / N, CONFIG.factions.inherit, 0.07);
    // Fondé à pied, près d'un village : celle de ce village ; par des colons : celle du village d'où ils partent.
    const state = State.create(9);
    state.faction = 'illumines';
    const a = village(state, { radius: 300 });
    assert.equal(a.faction, 'illumines');
    const b = village(state, { x: 5000, radius: 300 });
    b.faction = 'eleveurs';
    state.player.x = 6200;
    const c = Villages.found(state, 'atelier');
    assert.equal(c.faction, Factions.inherit(state, 'eleveurs', Vide.FACTIONS, c.id), 'depuis le plus proche');
    state.light = state.totalLight = 1e9;
    state.player.x = 0;
    a.beings.lueur = 10;
    const exp = Expeditions.launch(state, 'colons', -6000, 0, { type: 'jardins' });
    assert.ok(exp);
    exp.x = exp.tx;
    exp.y = exp.ty;
    const game = Sim.create(state);
    Sim.step(game, CONFIG.step, Sim.emptyInput());
    const d = state.villages.find((v) => v.type === 'jardins' && v.x < -5000);
    assert.ok(d, 'fondé par les colons');
    assert.equal(d.faction, Factions.inherit(state, 'illumines', Vide.FACTIONS, d.id));
  });

  test('chaque sous-faction change ses villages ; les bases ont les leurs, et leurs avant-postes en héritent', () => {
    const state = State.create(5);
    const v = village(state, { radius: 300 });
    const base = Villages.local(state, v);
    v.faction = 'eleveurs';
    assert.equal(Villages.local(state, v).beingCap, base.beingCap + 2);
    v.faction = 'illumines';
    assert.near(Villages.local(state, v).whitening, base.whitening * 1.4, 1e-9);
    const nest = Nests.add(state, 5000, 0, CONFIG.nests.levelEvery * 3);
    assert.ok(Factions.isDark(nest.faction));
    const outpost = Nests.spawnOutpost(state, nest);
    assert.equal(outpost.faction, Factions.inherit(state, nest.faction, Vide.DARK_FACTIONS, outpost.id));
  });

  test('sauvegarde : sous-factions gardées ; une partie ancienne choisit au retour (ses villages suivent) ; renaissance', () => {
    const state = State.create(6);
    state.faction = 'lames';
    village(state, { radius: 300 });
    Nests.add(state, 5000, 0, 0);
    const back = Save.deserialize(Save.serialize(state, 1)).state;
    assert.equal(back.faction, 'lames');
    assert.equal(back.villages[0].faction, 'lames');
    assert.equal(back.nests[0].faction, state.nests[0].faction);
    const old = JSON.parse(Save.serialize(state, 1));
    old.format = 23;
    delete old.state.faction;
    delete old.state.villages[0].faction;
    delete old.state.nests[0].faction;
    const migrated = Save.deserialize(JSON.stringify(old)).state;
    assert.equal(migrated.faction, null);
    assert.equal(migrated.villages[0].faction, null);
    assert.ok(Factions.isDark(migrated.nests[0].faction));
    assert.ok(Catalog.get('faction-eleveurs').revealed(migrated));
    Factions.choose(migrated, 'eleveurs');
    assert.equal(migrated.villages[0].faction, 'eleveurs');
    const bad = Save.sanitize({ faction: 'ombre', villages: [{ id: 1, x: 0, y: 0, faction: 'devoreurs' }], nests: [{ id: 1, x: 9, y: 9, faction: 'eleveurs' }] });
    assert.equal(bad.faction, null);
    assert.equal(bad.villages[0].faction, null);
    assert.ok(Factions.isDark(bad.nests[0].faction));
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.equal(state.faction, null, 'une vie neuve, un nouveau choix');
  });
})();
