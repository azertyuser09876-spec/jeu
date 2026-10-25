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

  // --- Le cerveau commun des gouverneurs ---

  test('le cerveau : l’action la plus voulue qu’il peut s’offrir ; sinon il économise, en ne s’accordant que de petites dépenses', () => {
    const { decide } = Vide.Governors;
    const a = { id: 'a', cost: 100, want: 1 }, b = { id: 'b', cost: 10, want: 0.8 }, c = { id: 'c', cost: 10, want: 0.2 };
    assert.equal(decide([b, a, c], 500).action, a);
    // Trop pauvre pour a : b (petite et presque aussi voulue) passe ; c (trop peu voulue) non.
    assert.equal(decide([a, b, c], 50).action, b);
    assert.equal(decide([a, b, c], 50).saving, a);
    const saving = decide([a, c], 50);
    assert.equal(saving.action, a);
    assert.equal(saving.done, false);
    assert.equal(decide([], 50), null);
    assert.equal(Vide.Governors.ambition(0), 0);
    assert.equal(Vide.Governors.ambition(1e9), 1);
  });

  test('le gouverneur bâtit selon le type de son village, et chaque exemplaire de plus lui fait moins envie', () => {
    const state = State.create(4);
    const v = village(state, { radius: 600, type: 'jardins', beings: { batisseur: 1, lueur: 6 } });
    v.funds = 1e9;
    const bought = Steward.catchUp(state, v, 40).filter((w) => w.kind === 'building').map((w) => w.id);
    assert.ok(bought.includes('serre'), 'la serre des jardins');
    assert.ok(bought.indexOf('serre') < bought.indexOf('archive') || !bought.includes('archive'));
    for (const w of Steward.wishes(state, v)) {
      if (w.kind !== 'building' || w.id === 'nid') continue;
      const n = Structures.countIn(v, w.id, true);
      assert.near(w.want, Steward.WANT[w.id] * Math.pow(0.75, n), 1e-9);
    }
  });

  test('quand la menace monte (guerre, base proche), il lève une milice en lumière et monte une enceinte', () => {
    const state = State.create(4);
    const v = village(state, { radius: 600, beings: { batisseur: 1, lueur: 6 } });
    v.funds = 1e9;
    assert.equal(Steward.threat(state, v), 0);
    assert.ok(!Steward.wishes(state, v).some((w) => w.id === 'gardien' || w.id === 'enceinte'));
    Vide.War.begin(state);
    assert.ok(Steward.threat(state, v) >= CONFIG.governors.militiaFrom);
    const done = Steward.catchUp(state, v, 60);
    const militia = done.filter((w) => w.id === 'gardien');
    assert.ok(militia.length > 0, 'une milice');
    assert.equal(militia[0].cost.light, Math.ceil(Colony.species('gardien').baseCost * CONFIG.governors.militiaPrice));
    assert.ok(!militia[0].cost.echoes, 'jamais d’échos');
    assert.ok(done.some((w) => w.id === 'enceinte'), 'une enceinte');
    assert.equal(v.walls.length, 1);
  });

  test('il dit ce qu’il vise : il économise pour le plus voulu', () => {
    const state = State.create(4);
    const v = village(state, { radius: 300 });
    v.funds = 10;
    assert.equal(Steward.act(state, v), null);
    const goal = Steward.intent(v);
    assert.equal(goal.id, 'batisseur');
    assert.ok(goal.saving);
    assert.equal(Steward.label(goal), 'bâtisseur');
  });

  // --- Ambitions ---

  test('sans ambition, il ne s’agrandit pas ; ambitieux, il relie, fait une cité de sa sous-faction, envoie des colons', () => {
    const state = State.create(6);
    state.faction = 'illumines';
    const v = village(state, { radius: 760, beings: { batisseur: 2, lueur: 14 } });
    const other = village(state, { x: 4000, radius: 300 });
    v.funds = 1e12;
    const kinds = () => Steward.wishes(state, v).map((w) => w.kind);
    assert.ok(!kinds().some((k) => ['road', 'city', 'colons'].includes(k)), 'pas encore');
    state.stats.playTime = CONFIG.governors.ambitionTime;
    assert.ok(kinds().includes('road'));
    assert.ok(kinds().includes('colons'));
    const done = Steward.catchUp(state, v, 200).map((w) => w.kind);
    assert.ok(done.includes('road'), 'une route');
    assert.ok(state.roads.some((r) => [r.a, r.b].includes(other.id)));
    const colons = state.expeditions.find((e) => e.kind === 'colons');
    assert.ok(colons, 'des colons en route');
    assert.equal(colons.from, v.id);
    assert.equal(colons.type, v.type);
    assert.ok(v.funds < 1e12, 'payés sur sa réserve');
    // Une cité, celle de sa sous-faction (les Illuminés : le sanctuaire), dès que le village peut se spécialiser.
    if (Vide.Cities.canSpecialize(v) || v.extra.length) {
      assert.ok(v.extra.includes(CONFIG.governors.specialty.illumines));
    }
  });

  test('ambitieux et bien armé, il mène l’armée de son village contre une base proche, qui tombe', () => {
    const state = State.create(7);
    const v = village(state, { radius: 300, beings: { gardien: 10, etincelle: 6 } });
    state.upgrades.edge = 8;
    const nest = Vide.Nests.add(state, 1600, 0, 0);
    state.stats.playTime = CONFIG.governors.ambitionTime;
    v.steward = 0.1;
    v.funds = 1;
    const w = Steward.wishes(state, v).find((x) => x.kind === 'campaign');
    assert.ok(w, 'une campagne voulue');
    w.act();
    assert.equal(v.campaign, nest.id);
    state.player.x = -5000;
    const game = Sim.create(state);
    const a = Vide.Combat.anchor(game, game.colony.beings[0]);
    assert.equal(a.nest, nest, 'en garde, l’armée assiège sa base');
    let ended = null;
    for (let i = 0; i < 60 * 180 && !ended; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      ended = game.events.find((e) => e.type === 'campaignEnd') || null;
    }
    assert.ok(ended && ended.won, 'la base est tombée');
    assert.equal(v.campaign, null);
  });

  test('sauvegarde : la campagne d’un village se garde ; nettoyée ; les anciennes parties n’en ont pas', () => {
    const state = State.create(7);
    const v = village(state, { radius: 300 });
    v.campaign = 4;
    assert.equal(Save.deserialize(Save.serialize(state, 1)).state.villages[0].campaign, 4);
    const old = JSON.parse(Save.serialize(state, 1));
    old.format = 25;
    delete old.state.villages[0].campaign;
    assert.equal(Save.deserialize(JSON.stringify(old)).state.villages[0].campaign, null);
    assert.equal(Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, campaign: 'x' }] }).villages[0].campaign, null);
  });
})();
