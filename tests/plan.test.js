(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { State, Plan, Structures, Territory, Save } = Vide;

  // Un grand village, des bâtisseurs ; on pose `types` dans l'ordre.
  function build(types, radius) {
    const state = State.create(8);
    const v = village(state, { radius: radius || 600 });
    for (const t of types) Structures.plan(state, v, t);
    return { state, v };
  }

  const dist = (v, b) => Math.hypot(b.x - v.x, b.y - v.y);
  const mean = (v, list) => list.reduce((s, b) => s + dist(v, b), 0) / list.length;

  test('le plan : des îlots entre les boulevards, jamais sur une avenue, toujours dans le territoire', () => {
    const state = State.create(2);
    const v = village(state, { x: 700, y: -300, radius: 500 });
    const slots = Plan.slots(v);
    assert.ok(slots.length > 30, `${slots.length} emplacements`);
    for (const s of slots) {
      assert.ok(Territory.contains(v, s.x, s.y));
      assert.near((s.r / Plan.STREET) % 1, 0.5, 1e-9, 'au milieu d’un îlot');
      assert.ok(Plan.offAvenue(v, s.a) * s.r >= Plan.LANE - 1e-6, 'pas sur une avenue');
      assert.near(Math.hypot(s.x - v.x, s.y - v.y), s.r, 1e-6);
    }
    // Toujours le même plan, et chaque village a son orientation.
    assert.deepEqual(Plan.slots(v), slots);
    const w = village(state, { x: 5000, radius: 300 });
    assert.equal(Plan.avenues(v).length, Plan.AVENUES);
    assert.ok(Math.abs(Plan.turn(v) - Plan.turn(w)) > 1e-6);
  });

  test('chaque bâtiment à sa place : vie et savoir au centre, logis autour, production plus loin, défense au bord', () => {
    const { v } = build(['nid', 'tour', 'source', 'prisme', 'archive', 'nid', 'phare', 'tour', 'nid', 'rempart', 'prisme', 'fontaine']);
    const of = (...ids) => v.buildings.filter((b) => ids.includes(b.type));
    const centre = mean(v, of('source', 'archive', 'fontaine'));
    const homes = mean(v, of('nid'));
    const production = mean(v, of('prisme', 'phare'));
    const defense = mean(v, of('tour', 'rempart'));
    assert.ok(centre < homes && homes < production && production < defense, `${centre} ${homes} ${production} ${defense}`);
    // La défense se range près des avenues (des portes).
    const gap = (b) => Plan.offAvenue(v, Math.atan2(b.y - v.y, b.x - v.x)) * dist(v, b);
    for (const b of of('tour')) assert.ok(gap(b) < Plan.SPACING * 1.2, `tour à ${Math.round(gap(b))} d’une avenue`);
  });

  test('deux bâtiments ne se chevauchent jamais, et un bâtiment posé ne bouge plus quand le village grandit', () => {
    const { state, v } = build(Array(14).fill('nid').concat(['prisme', 'prisme', 'tour', 'tour']), 450);
    for (const a of v.buildings) {
      for (const b of v.buildings) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= Plan.SPACING * 0.6);
    }
    const before = v.buildings.map((b) => [b.x, b.y]);
    v.area *= 3;
    Territory.grow(v);
    Structures.plan(state, v, 'phare');
    assert.deepEqual(v.buildings.slice(0, before.length).map((b) => [b.x, b.y]), before);
    // Le nouveau est sur le plan agrandi.
    const last = v.buildings[v.buildings.length - 1];
    assert.ok(Plan.slots(v).some((s) => Math.hypot(s.x - last.x, s.y - last.y) < 1e-6));
  });

  test('une cité garde des places autour de ses anciens cœurs', () => {
    const state = State.create(4);
    const v = village(state, { radius: 600 });
    v.districts.push({ x: 300, y: 0, type: 'bastion' });
    for (const s of Plan.free(v)) assert.ok(Math.hypot(s.x - 300, s.y) >= Plan.PLAZA);
    for (let i = 0; i < 20; i++) Structures.plan(state, v, 'nid');
    for (const b of v.buildings) assert.ok(Math.hypot(b.x - 300, b.y) >= Plan.PLAZA);
  });

  test('l’intendant suit le plan', () => {
    const state = State.create(6);
    const v = village(state, { radius: 400, beings: { lueur: 6, batisseur: 1 } });
    v.funds = 1e6;
    for (let i = 0; i < 6; i++) Vide.Steward.act(state, v);
    assert.ok(v.buildings.length > 0);
    const slots = Plan.slots(v);
    for (const b of v.buildings) assert.ok(slots.some((s) => Math.hypot(s.x - b.x, s.y - b.y) < 1e-6), b.type);
  });

  test('sauvegarde : les bâtiments d’un ancien village se rangent sur le plan, ceux d’une cité restent', () => {
    const state = State.create(3);
    const v = village(state, { radius: 400 });
    const c = village(state, { x: 4000, radius: 400 });
    c.districts.push({ x: 4200, y: 0, type: 'jardins' });
    const odd = [{ type: 'nid', x: 12, y: 7, work: 40 }, { type: 'tour', x: 13, y: 9, work: 3 }, { type: 'prisme', x: -5, y: 2, work: 0 }];
    v.buildings.push(...odd.map((b) => ({ ...b })));
    c.buildings.push({ type: 'nid', x: 4010, y: 5, work: 40 });
    const data = JSON.parse(Save.serialize(state, 1));
    data.format = 19;
    const loaded = Save.deserialize(JSON.stringify(data)).state;
    const [lv, lc] = loaded.villages;
    const slots = Plan.slots(lv);
    lv.buildings.forEach((b, i) => {
      assert.equal(b.type, odd[i].type);
      assert.equal(b.work, odd[i].work);
      assert.ok(slots.some((s) => Math.hypot(s.x - b.x, s.y - b.y) < 1e-6), b.type);
    });
    assert.deepEqual([lc.buildings[0].x, lc.buildings[0].y], [4010, 5]);
    // Des villages abîmés ne font pas échouer le chargement.
    const broken = JSON.stringify({ format: 19, state: { villages: [{ cells: 'x', buildings: [{ type: '?' }] }, null, 4, { x: 1, y: 2, cells: [0, 0, 0], buildings: [{ type: 'inconnu', x: 0, y: 0 }] }] } });
    assert.ok(Save.deserialize(broken).state);
  });
})();
