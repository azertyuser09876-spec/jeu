(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Villages, Sim, Roads, Trade, Offline, Save, Colony } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Un atelier peuplé, relié par une route achevée à des jardins.
  function linked() {
    const state = State.create(1);
    const atelier = village(state, { type: 'atelier', radius: 250, beings: { lueur: 10 } });
    const jardins = village(state, { x: 1400, radius: 250 });
    Roads.plan(state, atelier, jardins).work = 1400;
    state.player.x = 50000;
    return { state, atelier, jardins };
  }

  test('un atelier produit de la matière selon sa population ; un observatoire, du savoir', () => {
    const state = State.create(1);
    const a = village(state, { type: 'atelier', beings: { lueur: 10 } });
    const o = village(state, { x: 3000, type: 'observatoire', beings: { lueur: 10 } });
    const j = village(state, { x: 6000, beings: { lueur: 10 } });
    for (const v of state.villages) Trade.produce(v, 10);
    assert.near(a.stock.matiere, CONFIG.trade.matterRate * 10 * 10, 1e-9);
    assert.near(o.stock.savoir, (CONFIG.trade.knowledgeRate * 10 - CONFIG.trade.knowledgeUse) * 10, 1e-9);
    assert.deepEqual(j.stock, { matiere: 0, savoir: 0 });
    Trade.produce(a, 1e6);
    assert.equal(a.stock.matiere, CONFIG.trade.cap, 'plafonné');
  });

  test('matière et savoir en stock accélèrent chantiers et croissance ; les bâtisseurs consomment la matière', () => {
    const state = State.create(1);
    const v = village(state, { beings: { batisseur: 2 } });
    const base = Villages.local(state, v);
    v.stock.matiere = 10;
    v.stock.savoir = 10;
    const boosted = Villages.local(state, v);
    assert.near(boosted.buildRate, base.buildRate * CONFIG.trade.matterBoost, 1e-9);
    assert.near(boosted.territoryGrowth, base.territoryGrowth * CONFIG.trade.knowledgeBoost, 1e-9);
    Trade.produce(v, 10);
    assert.near(v.stock.matiere, 10 - CONFIG.trade.matterUse * 2 * 10, 1e-9);
  });

  test('une caravane porte le surplus le long de la route, et ne le retire qu’en arrivant', () => {
    const { state, atelier, jardins } = linked();
    atelier.stock.matiere = 100;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, CONFIG.trade.every + 0.1);
    assert.equal(game.trade.caravans.length, 1, 'une seule à la fois dans ce sens');
    const c = game.trade.caravans[0];
    assert.equal(c.from, atelier);
    assert.equal(c.kind, 'matiere');
    // Elle suit le tracé de la route (avenues, portes, grande route).
    assert.near(c.duration, Vide.Roads.pathLength(Vide.Roads.route(atelier, jardins)) / CONFIG.trade.caravanSpeed, 0.01);
    assert.ok(game.events.some((e) => e.type === 'caravanOut'));
    const before = atelier.stock.matiere;
    assert.ok(before > 90, 'pas encore retirée');
    run(game, c.duration + 0.2);
    assert.ok(jardins.stock.matiere > 0);
    assert.ok(atelier.stock.matiere < before);
  });

  test('sans route achevée, rien ne circule', () => {
    const { state, atelier } = linked();
    state.roads[0].work = 10;
    atelier.stock.matiere = 100;
    const game = Sim.create(state);
    run(game, CONFIG.trade.every * 2);
    assert.equal(game.trade.caravans.length, 0);
  });

  test('un bastion forme des soldats avec sa réserve, et les envoie contre lumière à un village mal défendu', () => {
    const state = State.create(1);
    const bastion = village(state, { type: 'bastion', radius: 200 });
    const jardins = village(state, { x: 1200, radius: 600 });
    Roads.plan(state, bastion, jardins).work = 1200;
    bastion.funds = 1e9;
    for (let k = 0; k < 6; k++) Trade.train(state, bastion);
    assert.equal(bastion.beings.gardien, 6);
    assert.ok(Trade.armyIn(bastion) > Trade.need(bastion));
    // Le village voisin ne peut pas payer : aucun soldat.
    assert.equal(Trade.shipment(state, bastion, jardins), null);
    jardins.funds = 1e6;
    const load = Trade.shipment(state, bastion, jardins);
    assert.equal(load.kind, 'soldat');
    const funds = bastion.funds;
    assert.ok(Trade.deliver(state, { from: bastion, to: jardins, ...load }));
    assert.equal(bastion.beings.gardien, 5);
    assert.equal(jardins.beings.gardien, 1);
    assert.equal(jardins.funds, 1e6 - load.price);
    assert.equal(bastion.funds, funds + load.price, 'le bastion est payé');
    // Un village qui n'est pas un bastion ne forme personne.
    jardins.funds = 1e9;
    assert.equal(Trade.train(state, jardins), false);
  });

  test('pendant l’absence, les ressources se produisent et se partagent le long des routes', () => {
    const { state, atelier, jardins } = linked();
    Offline.apply(state, 3600);
    assert.ok(atelier.stock.matiere > 0);
    assert.ok(jardins.stock.matiere > 0, 'les jardins ont reçu de la matière');
  });

  test('stocks sauvegardés : relus, nettoyés ; migration', () => {
    const { state, atelier } = linked();
    atelier.stock = { matiere: 42.5, savoir: 3 };
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state, state);
    const bad = Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, stock: { matiere: -2, savoir: 1e9, autre: 4 } }] });
    assert.deepEqual(bad.villages[0].stock, { matiere: 0, savoir: CONFIG.trade.cap });
    const old = Save.deserialize(JSON.stringify({ format: 12, state: { villages: [{ id: 1, x: 0, y: 0 }] } }));
    assert.deepEqual(old.state.villages[0].stock, { matiere: 0, savoir: 0 });
  });
})();
