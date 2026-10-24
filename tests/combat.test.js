(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Stats, Territory, Structures, Catalog, Sim, Shadows, Combat, Colony, Save, Offline } = Vide;
  const dt = CONFIG.step;

  function world(radius, beings) {
    const state = State.create(11);
    Territory.light(state);
    state.territory.area = Math.PI * radius * radius;
    Object.assign(state.beings, beings || {});
    state.light = state.totalLight = 1e6;
    return state;
  }

  function newGame(state) {
    const game = Sim.create(state);
    game.field.particles.length = 0;
    return game;
  }

  function run(game, seconds, input) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, input || Sim.emptyInput());
  }

  // --- Marées ---

  test("pas de marée tant que le territoire est petit", () => {
    const game = newGame(world(100));
    run(game, CONFIG.shadows.tideInterval * 2);
    assert.equal(game.state.tides, 0);
    assert.equal(game.shadows.list.length, 0);
  });

  test('une marée arrive quand le territoire est assez grand, hors du territoire', () => {
    const game = newGame(world(200));
    game.shadows.tideTimer = 0.01;
    run(game, 0.05);
    assert.equal(game.state.tides, 1);
    assert.ok(game.shadows.list.length >= 2);
    for (const s of game.shadows.list) assert.ok(Math.hypot(s.x, s.y) > 200 + 300, 'née hors du territoire');
    assert.ok(game.events.some((e) => e.type === 'tide' && e.first));
  });

  test('les marées grossissent avec le temps et le territoire', () => {
    const state = world(200);
    const small = Shadows.tideBudget(state);
    state.tides = 6;
    state.territory.area *= 4;
    assert.ok(Shadows.tideBudget(state) > small + 4);
  });

  test("une marée sans proie avance vers le foyer et le ronge", () => {
    const state = world(160);
    state.player.x = 50000;
    const game = newGame(state);
    Shadows.spawn(game, 'errante', 300, 0, 'tide');
    const light = state.light;
    run(game, 15);
    assert.ok(state.light < light, 'le foyer doit perdre de la lumière');
    assert.ok(game.events.some((e) => e.type === 'foyerAttacked'));
  });

  // --- La lumière du joueur ---

  test('une ombre blesse la lumière, qui se régénère ensuite', () => {
    const state = world(160);
    state.player.x = 3000; // hors du territoire, régénération normale
    const game = newGame(state);
    const s = Shadows.spawn(game, 'errante', 3010, 0, 'roam');
    run(game, 1.2); // la première attaque peut tarder jusqu'à une recharge complète
    assert.ok(game.vitality.hp < game.stats.vitality);
    Shadows.damage(s, 1000);
    run(game, 0.1);
    const hurt = game.vitality.hp;
    run(game, CONFIG.combat.regenDelay + 2);
    assert.ok(game.vitality.hp > hurt);
  });

  test('à zéro vitalité, la lumière se disperse et renaît au foyer', () => {
    const state = world(160);
    state.player.x = 900;
    state.light = 1000;
    const game = newGame(state);
    Combat.hurtPlayer(game, 10000, 950, 0);
    assert.equal(state.player.x, 0);
    assert.near(state.light, 900, 1e-9);
    assert.equal(game.vitality.hp, game.stats.vitality);
    assert.ok(game.vitality.invulnerable > 0);
    Combat.hurtPlayer(game, 50, 10, 0);
    assert.equal(game.vitality.hp, game.stats.vitality, 'invulnérable juste après');
    assert.ok(game.events.some((e) => e.type === 'dispersed'));
  });

  // --- Pulsation et échos ---

  test("la pulsation blesse chaque ombre une seule fois par onde", () => {
    const state = world(160);
    state.player.x = 5000;
    const game = newGame(state);
    const s = Shadows.spawn(game, 'massive', 5100, 0, 'roam');
    Sim.pulse(game);
    run(game, 1);
    assert.equal(s.hp, s.maxHp - game.stats.pulseDamage);
  });

  test('une ombre vaincue laisse des échos et compte', () => {
    const state = world(160);
    state.player.x = 5000;
    const game = newGame(state);
    const s = Shadows.spawn(game, 'errante', 5100, 0, 'roam');
    Shadows.damage(s, 1000);
    run(game, dt);
    assert.equal(game.shadows.list.length, 0);
    assert.equal(state.echoes, Shadows.kind('errante').echoes);
    assert.equal(state.stats.shadows, 1);
    assert.ok(game.events.some((e) => e.type === 'shadowDown' && e.first));
  });

  // --- Êtres et bâtiments attaqués ---

  test('une rôdeuse traque les êtres ; un être vaincu se rallume au foyer plus tard', () => {
    const state = world(300, { lueur: 1 });
    state.player.x = 50000;
    const game = newGame(state);
    const lueur = game.colony.beings[0];
    lueur.x = 200; lueur.y = 0;
    Shadows.spawn(game, 'rodeuse', 260, 0, 'tide');
    run(game, 8);
    assert.ok(lueur.down > 0 || game.events.some((e) => e.type === 'beingDown'), 'la lueur doit tomber');
    run(game, CONFIG.colony.downTime + 1);
    assert.ok(Colony.isActive(lueur) || game.events.filter((e) => e.type === 'beingDown').length > 1);
  });

  test('une massive éteint un bâtiment ; un bâtisseur le répare et il refonctionne', () => {
    const state = world(300, { batisseur: 1 });
    state.player.x = 50000;
    const nid = Structures.plan(state, 'nid');
    nid.work = Structures.def('nid').work;
    const game = newGame(state);
    const cap = game.stats.beingCap;
    assert.ok(Structures.damage(game, nid, 10000));
    assert.ok(nid.broken);
    assert.equal(Stats.compute(state).beingCap, cap - 4, 'un nid éteint ne donne plus de place');
    run(game, 60);
    assert.equal(nid.broken, false);
    assert.equal(Stats.compute(state).beingCap, cap);
    assert.ok(game.events.some((e) => e.type === 'repaired'));
  });

  // --- Armée ---

  test("l'armée s'achète en lumière et en échos, après la première ombre vaincue", () => {
    const state = world(300, { lueur: 1 });
    assert.equal(Catalog.get('gardien').revealed(state), false);
    state.stats.shadows = 1;
    assert.ok(Catalog.get('gardien').revealed(state));
    const price = Catalog.get('gardien').cost(state);
    assert.ok(price.light > 0 && price.echoes > 0);
    state.echoes = 0;
    assert.equal(Catalog.buy(state, 'gardien'), false);
    state.echoes = 100;
    assert.ok(Catalog.buy(state, 'gardien'));
    assert.equal(state.echoes, 100 - price.echoes);
  });

  test('en garde, un gardien abat une ombre qui entre dans le territoire', () => {
    const state = world(250, { gardien: 1 });
    state.player.x = 50000;
    const game = newGame(state);
    const s = Shadows.spawn(game, 'errante', 200, 0, 'tide');
    run(game, 15);
    assert.ok(s.hp <= 0 || !game.shadows.list.includes(s));
    assert.ok(state.stats.shadows >= 1);
  });

  test("en garde, l'armée ne poursuit pas une ombre loin du territoire", () => {
    const state = world(200, { gardien: 1 });
    state.player.x = 50000;
    const game = newGame(state);
    const s = Shadows.spawn(game, 'errante', 2000, 0, 'roam');
    s.target = null;
    run(game, 3);
    const g = game.colony.beings[0];
    assert.ok(Math.hypot(g.x, g.y) < 600, 'le gardien reste près du territoire');
  });

  test("en escorte, l'armée suit la lumière", () => {
    const state = world(200, { gardien: 2 });
    Combat.setPosture(state, 'escorte');
    state.player.x = 1500;
    const game = newGame(state);
    run(game, 25);
    for (const g of game.colony.beings) {
      assert.ok(Math.hypot(g.x - state.player.x, g.y - state.player.y) < 150, 'le gardien escorte le joueur');
    }
  });

  test('un ordre inconnu est refusé', () => {
    const state = State.create(1);
    assert.equal(Combat.setPosture(state, 'danse'), false);
    assert.equal(state.army.posture, 'garde');
    assert.ok(Combat.setPosture(state, 'chasse'));
  });

  test('une étincelle tire des traits qui blessent les ombres', () => {
    const state = world(300, { etincelle: 1 });
    state.player.x = 50000;
    const game = newGame(state);
    const s = Shadows.spawn(game, 'massive', 150, 0, 'tide');
    s.cd = 99; // la massive n'attaque pas pendant le test
    let fired = false;
    for (let i = 0; i < 60 * 6; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      fired = fired || game.projectiles.length > 0;
      s.cd = 99;
    }
    assert.ok(fired);
    assert.ok(s.hp < s.maxHp);
  });

  test('une veilleuse soigne un être blessé', () => {
    const state = world(300, { veilleuse: 1, gardien: 1 });
    state.player.x = 50000;
    const game = newGame(state);
    run(game, 0.1);
    const g = game.colony.beings.find((b) => b.species === 'gardien');
    g.hp = 10;
    g.lastHurt = game.time; // pas de régénération naturelle
    for (let i = 0; i < 60 * 6; i++) {
      g.lastHurt = game.time;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(g.hp > 25, `pv ${g.hp}`);
  });

  test('une tour de lumière tire sur les ombres à portée', () => {
    const state = world(300);
    state.player.x = 50000;
    const tour = Structures.plan(state, 'tour');
    tour.work = Structures.def('tour').work;
    const game = newGame(state);
    const s = Shadows.spawn(game, 'massive', tour.x + 100, tour.y, 'tide');
    s.cd = 99;
    for (let i = 0; i < 60 * 4; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      s.cd = 99;
    }
    assert.ok(s.hp < s.maxHp);
  });

  test("les améliorations de combat se paient en échos", () => {
    const state = world(300);
    state.stats.shadows = 1;
    state.echoes = 3;
    assert.ok(Catalog.get('scorch').revealed(state));
    assert.deepEqual(Catalog.get('scorch').cost(state), { echoes: 3 });
    assert.ok(Catalog.buy(state, 'scorch'));
    assert.equal(state.echoes, 0);
    assert.ok(Stats.compute(state).pulseDamage > CONFIG.combat.pulseDamage);
  });

  test("pendant l'absence, aucune ombre ne vient", () => {
    const state = world(400, { lueur: 2 });
    state.colonyRate = 1;
    Offline.apply(state, 3600);
    assert.equal(state.tides, 0);
  });

  // --- Sauvegarde ---

  test('une sauvegarde de la 0.4 (format 4) se charge, sans échos ni marée', () => {
    const text = JSON.stringify({ format: 4, state: { light: 3, buildings: [{ type: 'nid', x: 1, y: 2, work: 40 }] } });
    const result = Save.deserialize(text);
    assert.ok(result.ok);
    assert.equal(result.state.echoes, 0);
    assert.equal(result.state.tides, 0);
    assert.equal(result.state.army.posture, 'garde');
    assert.equal(result.state.buildings.length, 1);
  });

  test('échos, ordre, marées et bâtiments éteints sont relus et nettoyés', () => {
    const state = Save.sanitize({
      echoes: 12.5, tides: 3, army: { posture: 'chasse' }, stats: { shadows: 40 },
      buildings: [{ type: 'nid', x: 1, y: 1, work: 40, broken: true }, { type: 'nid', x: 9, y: 9, work: 3, broken: true }],
    });
    assert.equal(state.echoes, 12.5);
    assert.equal(state.tides, 3);
    assert.equal(state.army.posture, 'chasse');
    assert.equal(state.stats.shadows, 40);
    assert.equal(state.buildings[0].broken, true);
    assert.equal(state.buildings[1].broken, undefined, 'un chantier ne peut pas être éteint');
    const bad = Save.sanitize({ echoes: -1, tides: 2.5, army: { posture: 'fuite' } });
    assert.equal(bad.echoes, 0);
    assert.equal(bad.tides, 0);
    assert.equal(bad.army.posture, 'garde');
  });
})();
