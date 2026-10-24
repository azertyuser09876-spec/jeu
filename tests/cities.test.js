(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Villages, Catalog, Sim, Roads, Cities, Territory, Save } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Des jardins et un atelier dont les territoires se touchent ; un bastion au loin, relié aux deux.
  function neighbors() {
    const state = State.create(1);
    const jardins = village(state, { radius: 400, beings: { lueur: 5 } });
    const atelier = village(state, { x: 700, radius: 330, type: 'atelier', beings: { lueur: 2, batisseur: 1 } });
    const bastion = village(state, { x: 5000, radius: 200, type: 'bastion' });
    atelier.buildings.push({ type: 'nid', x: 800, y: 0, work: 40 });
    atelier.stock.matiere = 30;
    atelier.funds = 100;
    Roads.plan(state, jardins, bastion).work = 10;
    Roads.plan(state, atelier, bastion).work = 4000;
    Roads.plan(state, jardins, atelier).work = 700;
    return { state, jardins, atelier, bastion };
  }

  test('deux villages dont les territoires se touchent fusionnent en une cité ; les autres non', () => {
    const { state, jardins, atelier, bastion } = neighbors();
    assert.ok(Cities.touching(jardins, atelier));
    assert.equal(Cities.touching(jardins, bastion), false);
    const area = jardins.area + atelier.area;
    const merges = Cities.fuse(state);
    assert.equal(merges.length, 1);
    assert.deepEqual(state.villages.map((v) => v.type), ['jardins', 'bastion']);
    const city = state.villages[0];
    assert.ok(Cities.isCity(city));
    assert.deepEqual(city.extra, ['atelier']);
    assert.deepEqual(city.districts, [{ x: 700, y: 0, type: 'atelier' }]);
    assert.equal(city.area, area);
    assert.deepEqual(city.beings, { lueur: 7, batisseur: 1 });
    assert.equal(city.buildings.length, 1);
    assert.equal(city.stock.matiere, 30);
    assert.equal(city.funds, 100);
    assert.equal(city.cells.length / 3, Territory.targetCells(city));
    // Routes : celle qui reliait les deux disparaît, les autres passent à la cité (la plus avancée reste).
    assert.deepEqual(state.roads, [{ a: city.id, b: bastion.id, work: 4000 }]);
  });

  test('une cité cumule les effets de ses spécialités', () => {
    const { state } = neighbors();
    Cities.fuse(state);
    const city = state.villages[0];
    const base = Vide.Stats.compute(state);
    const local = Villages.local(state, city);
    assert.ok(local.gardenDensity > base.gardenDensity, 'jardins');
    assert.ok(local.buildRate > base.buildRate * 1.5, 'atelier (et sa matière)');
    assert.ok(Vide.Trade.hasType(city, 'atelier'), 'elle produit de la matière');
  });

  test('en jeu, la fusion est annoncée et les êtres, le jardin suivent la cité', () => {
    const { state, jardins, atelier } = neighbors();
    state.player.x = 50000;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, 2.5);
    assert.ok(game.events.some((e) => e.type === 'city'));
    assert.equal(state.villages.includes(atelier), false);
    for (const b of game.colony.beings) assert.equal(b.village === jardins || b.village === state.villages[1], true);
    assert.equal(game.colony.beings.filter((b) => b.village === jardins).length, 8);
    assert.ok(game.garden.particles.every((p) => p.village !== atelier.id));
  });

  test('un village immense peut ajouter une spécialité ; un petit, non', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e12;
    const v = village(state, { radius: 300 });
    assert.equal(Catalog.get('specialite-bastion').revealed(state), false);
    v.area = Math.PI * CONFIG.cities.radius ** 2;
    assert.ok(Catalog.get('specialite-bastion').revealed(state));
    assert.equal(Catalog.get('specialite-jardins').revealed(state), false, 'déjà des jardins');
    const first = Catalog.get('specialite-bastion').cost(state).light;
    assert.equal(first, CONFIG.cities.cost);
    assert.ok(Catalog.buy(state, 'specialite-bastion'));
    assert.deepEqual(v.extra, ['bastion']);
    assert.equal(Catalog.get('specialite-atelier').cost(state).light, first * CONFIG.cities.growth);
    assert.equal(Catalog.get('specialite-bastion').revealed(state), false);
  });

  test('cités sauvegardées : relues, nettoyées ; migration', () => {
    const { state } = neighbors();
    Cities.fuse(state);
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state, state);
    const bad = Save.sanitize({ villages: [{
      id: 1, x: 0, y: 0, type: 'atelier', extra: ['atelier', 'bastion', 'bastion', 'temple', 3],
      districts: [{ x: 1, y: 2, type: 'jardins' }, { x: NaN, y: 0, type: 'jardins' }, { x: 0, y: 0, type: 'x' }, 'z'],
    }] }).villages[0];
    assert.deepEqual(bad.extra, ['bastion']);
    assert.deepEqual(bad.districts, [{ x: 1, y: 2, type: 'jardins' }]);
    const old = Save.deserialize(JSON.stringify({ format: 13, state: { villages: [{ id: 1, x: 0, y: 0 }] } }));
    assert.deepEqual(old.state.villages[0].extra, []);
    assert.deepEqual(old.state.villages[0].districts, []);
  });
})();
