(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Catalog, Factions, Villages, Nests, Save, Renaissance, Expeditions, Sim } = Vide;

  test('à chaque fondation, le joueur choisit le type et la sous-faction ; il change celle d’un village quand il veut', () => {
    const state = State.create(3);
    state.light = state.totalLight = 1e9;
    assert.equal(Catalog.get('village-jardins').blocked(state), 'choisis ta sous-faction');
    Factions.choose(state, 'lames');
    assert.ok(Catalog.buy(state, 'village-jardins'));
    assert.equal(state.villages[0].faction, 'lames');
    // Une autre fondation, un autre choix (ni hérité ni muté : c'est le joueur qui fonde).
    state.player.x = 8000;
    Factions.choose(state, 'eleveurs');
    assert.ok(Catalog.buy(state, 'village-bastion'));
    assert.equal(state.villages[1].faction, 'eleveurs');
    // Autant de changements qu'on veut, sans frais.
    const light = state.light;
    for (const id of ['illumines', 'lames', 'eleveurs', 'illumines']) {
      assert.ok(Factions.setVillage(state, state.villages[0], id));
      assert.equal(state.villages[0].faction, id);
    }
    assert.equal(state.light, light);
    assert.equal(state.faction, 'illumines', 'le dernier choix sert aux prochaines fondations');
    assert.ok(!Factions.setVillage(state, state.villages[0], 'corrupteurs'), 'pas une sous-faction des ombres');
  });

  test('un village né d’un autre (des colons) en hérite le plus souvent ; sinon il mute', () => {
    let same = 0;
    const N = 400;
    for (let id = 1; id <= N; id++) {
      const state = State.create(id);
      const f = Factions.inherit(state, 'eleveurs', Vide.FACTIONS, id + 1);
      assert.ok(Factions.isLight(f));
      if (f === 'eleveurs') same++;
    }
    assert.near(same / N, CONFIG.factions.inherit, 0.07);
    // Fondé par des colons : celle du village d'où ils partent, le plus souvent (ou une mutation).
    const state = State.create(9);
    state.faction = 'illumines';
    const a = village(state, { radius: 300 });
    assert.equal(a.faction, 'illumines');
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
