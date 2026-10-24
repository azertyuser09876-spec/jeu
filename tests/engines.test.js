(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Colossus, Engines, Expeditions, Nests, Combat, Offline, Save, Renaissance } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // Un village avec des bâtisseurs, de la lumière ; le Veilleur entendu, ses sceaux étudiés.
  function world() {
    const state = State.create(31);
    village(state, { radius: 300, beings: { batisseur: 3 } });
    state.light = state.totalLight = 1e7;
    state.stats.shadows = 15;
    for (const d of Vide.COLOSSI) state.studied[d.id] = d.seals.length;
    return state;
  }

  // Le Veilleur en chasse, la lumière à `dist` de lui (immobile, invulnérable).
  function hunting(state, dist) {
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, dt);
    const c = game.colossi[0];
    state.player.x = c.x + dist;
    state.player.y = c.y;
    run(game, 0.1); // il la remarque…
    game.vitality.invulnerable = 1e9; // …puis elle ne craint plus rien (il chasse tant qu'elle reste proche)
    c.attackCd = 1e9;
    return { game, c };
  }

  // --- Sapeurs ---

  test('des sapeurs (deux bâtisseurs) partent bâtir un engin sur place, puis rentrent', () => {
    const state = world();
    const v = state.villages[0];
    v.beings.batisseur = 1;
    assert.ok(Expeditions.blocked(state, 'sappers', 3000, 0, false, 'baliste').includes('bâtisseurs'));
    v.beings.batisseur = 3;
    assert.equal(Expeditions.blocked(state, 'sappers', 3000, 0, false, 'catapulte'), 'quel engin ?');
    const light = state.light;
    const exp = Expeditions.launch(state, 'sappers', 3000, 0, { engine: 'baliste' });
    assert.ok(exp);
    assert.equal(state.light, light - CONFIG.engines.cost.baliste);
    assert.equal(v.beings.batisseur, 1, 'deux bâtisseurs partis');
    // Pendant l'absence : marche, chantier, retour.
    const travel = 3000 / CONFIG.expeditions.speed;
    const report = Offline.apply(state, travel + 5);
    assert.equal(state.engines.length, 1);
    assert.ok(state.engines[0].built > 0 && state.engines[0].built < 1, 'en chantier');
    assert.ok(report.expeditions.some((e) => e.type === 'siteStarted'));
    Offline.apply(state, CONFIG.engines.buildTime + travel + 5);
    assert.ok(Engines.ready(state.engines[0]));
    assert.deepEqual([state.engines[0].x, state.engines[0].y], [3000, 0]);
    assert.equal(state.expeditions.length, 0);
    assert.equal(v.beings.batisseur, 3, 'les sapeurs sont rentrés');
  });

  test('un chantier écrasé renvoie ses sapeurs ; pas plus de huit engins', () => {
    const state = world();
    const exp = Expeditions.launch(state, 'sappers', 2000, 0, { engine: 'chaine' });
    exp.x = exp.tx;
    exp.y = exp.ty;
    Expeditions.arrive(state, exp);
    state.engines.length = 0;
    const done = Expeditions.erect(state, exp, 1);
    assert.ok(exp.back);
    assert.equal(done.events[0].type, 'siteLost');
    for (let k = 0; k < CONFIG.engines.max; k++) Engines.add(state, 'chaine', k * 100, 5000);
    assert.equal(Expeditions.blocked(state, 'sappers', 3000, 0, false, 'chaine'), 'assez d’engins');
  });

  // --- Baliste ---

  test('une baliste tire sur un colosse en combat à sa portée : sa jauge se remplit', () => {
    const state = world();
    const { game, c } = hunting(state, 600);
    const e = Engines.add(state, 'baliste', c.x, c.y + 900);
    c.stagger = 0;
    Sim.step(game, dt, Sim.emptyInput());
    assert.ok(c.stagger >= CONFIG.engines.ballista.stagger * 0.9, `jauge ${c.stagger}`);
    assert.ok(game.events.some((x) => x.type === 'bolt'));
    // Puis elle recharge.
    const after = c.stagger;
    run(game, CONFIG.engines.ballista.reload * 0.5);
    assert.ok(c.stagger <= after + 1e-9);
    // Trop loin : rien.
    e.y = c.y + 50000;
    const before = c.stagger;
    run(game, CONFIG.engines.ballista.reload + 0.5);
    assert.ok(c.stagger <= before + 1e-9);
  });

  test('sans colosse, la baliste vise le cœur d’un nid à portée', () => {
    const state = world();
    const game = Sim.create(state);
    const nest = Nests.add(state, 5000, 0, 0);
    Engines.add(state, 'baliste', 4000, 0);
    const hp = nest.hp;
    Sim.step(game, dt, Sim.emptyInput());
    assert.ok(nest.hp <= hp - CONFIG.engines.ballista.nestDamage + 1);
  });

  test('un engin en chantier ne fait rien', () => {
    const state = world();
    const { game, c } = hunting(state, 600);
    Engines.add(state, 'baliste', c.x, c.y + 900, 0.5);
    c.stagger = 0;
    run(game, 0.5);
    assert.equal(c.stagger, 0);
  });

  // --- Chaîne ---

  test('une chaîne retient le colosse qui passe à sa portée : ralenti, jauge qui monte, puis elle cède', () => {
    const chase = (chained) => {
      const state = world();
      const { game, c } = hunting(state, 1200);
      if (chained) Engines.add(state, 'chaine', c.core.x, c.core.y);
      const x0 = c.x, y0 = c.y;
      c.stagger = 0;
      // La lumière reste loin : il marche vers elle.
      for (let i = 0; i < Math.round(3 / dt); i++) {
        state.player.x = x0 + 1200;
        state.player.y = y0;
        Sim.step(game, dt, Sim.emptyInput());
      }
      return { state, game, c, moved: Math.hypot(c.x - x0, c.y - y0) };
    };
    const free = chase(false);
    const held = chase(true);
    assert.ok(held.c.bound, 'retenu');
    assert.ok(held.moved < free.moved * 0.6, `${held.moved} contre ${free.moved}`);
    assert.ok(held.c.stagger > free.c.stagger + CONFIG.engines.chain.stagger, 'sa jauge monte');
    assert.ok(held.game.events.some((e) => e.type === 'chained'));
    // Elle s'use, puis cède.
    held.state.engines[0].hp = 0.5;
    run(held.game, 1);
    assert.equal(held.state.engines.length, 0);
    assert.ok(held.game.events.some((e) => e.type === 'engineLost' && e.reason === 'snapped'));
  });

  test('retenu par une chaîne, il reste plus longtemps à genou', () => {
    const state = world();
    const { game, c } = hunting(state, 600);
    Engines.add(state, 'chaine', c.core.x, c.core.y);
    Colossus.hit(game, c, c.def.stagger + 1);
    assert.equal(c.mode, 'kneel');
    run(game, c.def.kneel + 0.5);
    assert.equal(c.mode, 'kneel', 'toujours à genou');
  });

  test('les pas du colosse et son séisme écrasent les engins', () => {
    const state = world();
    const { game, c } = hunting(state, 600);
    const foot = c.legs[0].foot;
    const e = Engines.add(state, 'baliste', foot.x, foot.y);
    Engines.damageAt(game, foot.x, foot.y, 50, CONFIG.engines.footDamage);
    assert.equal(e.hp, Engines.def('baliste').hp - CONFIG.engines.footDamage);
    // Le séisme le traverse (pas de brèche sur lui).
    e.x = c.core.x + 300;
    e.y = c.core.y;
    Colossus.startAttack(game, c, 'quake');
    c.attack.gaps = [Math.PI];
    const hp = e.hp;
    run(game, c.attack.telegraph + 1.5);
    assert.ok(e.hp <= hp - CONFIG.engines.quakeDamage + 1e-9 || !state.engines.includes(e));
  });

  // --- Troupes de siège ---

  test('les harpons frappent sept fois plus fort un colosse ou un nid, pas une ombre', () => {
    const state = world();
    const game = Sim.create(state);
    const sp = Vide.Colony.species('harponneur');
    assert.ok(sp.army && sp.siege > 1);
    const nest = Nests.add(state, 2000, 0, 0);
    const target = Nests.target(nest);
    Combat.fire(game, 1990, 0, target, sp.damage * sp.siege, 'harpoon', sp.siege);
    const hp = nest.hp;
    run(game, 0.2);
    assert.ok(nest.hp <= hp - sp.damage * sp.siege + 1);
    // Une ombre prise en chemin ne subit que le harpon nu.
    const s = Vide.Shadows.spawn(game, 'massive', 1000, 0, 'roam');
    s.cd = 99;
    const shp = s.hp;
    Combat.fire(game, 990, 0, Nests.target(nest), sp.damage * sp.siege, 'harpoon', sp.siege);
    Sim.step(game, dt, Sim.emptyInput());
    assert.near(shp - s.hp, sp.damage, sp.damage * 0.5);
  });

  test('le harponneur paraît dès qu’un colosse ou un nid s’est montré', () => {
    const state = State.create(1);
    village(state, { beings: { gardien: 1 } });
    const sp = Vide.Colony.species('harponneur');
    assert.equal(sp.requires(state), false);
    state.colossi.veilleur = 'heard';
    assert.ok(sp.requires(state));
  });

  test('en siège, l’armée part contre un colosse en combat près de son village', () => {
    const state = world();
    const { game, c } = hunting(state, 600);
    state.villages[0].beings.gardien = 1;
    Combat.setPosture(state, 'siege');
    run(game, dt);
    const b = game.colony.beings.find((x) => x.species === 'gardien');
    const a = Combat.anchor(game, b);
    assert.ok(Math.hypot(a.x - c.core.x, a.y - c.core.y) < 1, 'il vise le colosse');
  });

  // --- Sauvegarde ---

  test('engins sauvegardés, nettoyés ; disparus à la renaissance', () => {
    const state = world();
    Engines.add(state, 'baliste', 10, 20, 0.4);
    Engines.add(state, 'chaine', -10, 5);
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state.engines, state.engines);
    const bad = Save.sanitize({
      engines: [{ id: 1, kind: 'baliste', x: 0, y: 0, hp: 1e9, built: 7 }, { id: 1, kind: 'chaine', x: 1, y: 1 },
        { id: 2, kind: 'trébuchet', x: 0, y: 0 }, { id: 3, kind: 'chaine', x: NaN, y: 0 }, null],
      expeditions: [{ id: 1, kind: 'sappers', engine: 'chaine', site: 42, x: 0, y: 0, tx: 1, ty: 1, members: { batisseur: 2 } }],
    });
    assert.equal(bad.engines.length, 1);
    assert.equal(bad.engines[0].hp, Engines.def('baliste').hp);
    assert.equal(bad.engines[0].built, 1);
    assert.equal(bad.expeditions[0].site, null, 'un chantier perdu : les sapeurs rebâtiront à l’arrivée');
    const old = Save.deserialize(JSON.stringify({ format: 17, state: {} })).state;
    assert.deepEqual(old.engines, []);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.deepEqual(state.engines, []);
  });
})();
