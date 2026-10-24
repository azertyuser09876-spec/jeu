(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Stats, Territory, Villages, Catalog, Sim, Colony, Structures, Shadows, Combat, Save } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, Sim.emptyInput());
  }

  // --- Fondation ---

  test('le premier village se fonde n’importe où, du type choisi', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1000;
    state.player.x = 2500;
    state.player.y = -700;
    assert.ok(Catalog.get('village-observatoire').revealed(state));
    assert.ok(Catalog.buy(state, 'village-observatoire'));
    assert.equal(state.villages.length, 1);
    const v = state.villages[0];
    assert.equal(v.type, 'observatoire');
    assert.equal(v.x, 2500);
    assert.equal(v.y, -700);
    assert.equal(state.light, 1000 - CONFIG.villages.firstCost);
  });

  test('chaque type de village est en boutique, chacun avec ses effets', () => {
    const state = State.create(1);
    state.totalLight = 1e9;
    const base = Stats.compute(state);
    for (const t of Vide.VILLAGE_TYPES) {
      state.player.x = Vide.VILLAGE_TYPES.indexOf(t) * 3000;
      assert.ok(Catalog.get('village-' + t.id).revealed(state), t.id);
      const v = Villages.found(state, t.id);
      const local = Villages.local(state, v);
      const changed = Object.keys(local).filter((k) => typeof local[k] === 'number' && local[k] !== (k in base ? base[k] : 1));
      assert.ok(changed.length >= 2, `${t.id} : ${changed.join(', ')}`);
    }
  });

  test('dans un village, on n’en fonde pas ; trop près non plus ; plus loin, oui, de plus en plus cher', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e9;
    village(state, { radius: 300 });
    state.player.x = 100;
    assert.equal(Catalog.get('village-jardins').revealed(state), false, 'dans un village, la boutique est la sienne');
    assert.equal(Villages.foundBlocked(state), 'hors des villages');
    state.player.x = 300 + CONFIG.villages.reach + 50;
    assert.equal(Catalog.get('village-jardins').blocked(state), 'trop près d’un village');
    state.player.x = 300 + CONFIG.villages.gap + 10;
    const second = Catalog.get('village-bastion').cost(state).light;
    assert.equal(second, CONFIG.villages.cost);
    assert.ok(Catalog.buy(state, 'village-bastion'));
    state.player.x = 5000;
    assert.equal(Catalog.get('village-atelier').cost(state).light, CONFIG.villages.cost * CONFIG.villages.growth);
  });

  test('le village où l’on se trouve : dans son territoire, à une petite marge près', () => {
    const state = State.create(1);
    const a = village(state, { radius: 200 });
    const b = village(state, { x: 2000, radius: 100 });
    state.player.x = 150;
    assert.equal(Villages.current(state), a);
    state.player.x = 200 + CONFIG.villages.reach - 1;
    assert.equal(Villages.current(state), a);
    state.player.x = 1000;
    assert.equal(Villages.current(state), null);
    state.player.x = 1950;
    assert.equal(Villages.current(state), b);
    assert.equal(Villages.main(state), a);
    assert.equal(Villages.nearest(state, 1200, 0), b);
  });

  // --- Boutique contextuelle ---

  test('un être s’éveille dans le village où l’on se trouve ; hors des villages, il faut en rejoindre un', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e7;
    const a = village(state);
    const b = village(state, { x: 3000 });
    state.player.x = 1500;
    assert.equal(Catalog.get('lueur').blocked(state), 'rejoins un village');
    state.player.x = 3000;
    const first = Catalog.get('lueur').cost(state).light;
    assert.ok(Catalog.buy(state, 'lueur'));
    assert.deepEqual(b.beings, { lueur: 1 });
    assert.deepEqual(a.beings, {});
    // Le prix ne bouge pas.
    state.player.x = 0;
    assert.equal(Catalog.get('lueur').cost(state).light, first);
    assert.ok(Catalog.buy(state, 'lueur'));
    assert.equal(Colony.count(state, 'lueur'), 2);
  });

  test('la population est plafonnée par village', () => {
    const state = State.create(1);
    state.light = state.totalLight = 1e12;
    const a = village(state);
    village(state, { x: 3000 });
    a.beings.lueur = Stats.compute(state).beingCap;
    assert.equal(Catalog.get('lueur').blocked(state), 'population pleine : un nid');
    state.player.x = 3000;
    assert.equal(Catalog.get('lueur').blocked(state), null, 'l’autre village a de la place');
  });

  test('les bâtiments d’un village n’agissent que sur lui', () => {
    const state = State.create(1);
    const a = village(state, { radius: 300 });
    const b = village(state, { x: 3000, radius: 300 });
    a.buildings.push({ type: 'nid', x: 0, y: 90, work: 999 });
    assert.equal(Villages.local(state, a).beingCap, CONFIG.colony.cap + 4);
    assert.equal(Villages.local(state, b).beingCap, CONFIG.colony.cap);
  });

  test('un plan se pose dans le village où l’on se trouve, autour de son cœur', () => {
    const state = State.create(5);
    state.light = state.totalLight = 1e7;
    village(state, { radius: 300, beings: { lueur: 1, batisseur: 1 } });
    const b = village(state, { x: 4000, y: 1000, radius: 400 });
    state.player.x = 4000;
    state.player.y = 1000;
    assert.equal(Catalog.get('nid').blocked(state), 'il faut un bâtisseur');
    b.beings.batisseur = 1;
    assert.ok(Catalog.buy(state, 'nid'));
    assert.equal(b.buildings.length, 1);
    const n = b.buildings[0];
    assert.ok(Math.abs(Math.hypot(n.x - 4000, n.y - 1000) - Structures.def('nid').ring * 400) <= Vide.Plan.STREET / 2);
    state.player.x = 2000;
    assert.equal(Catalog.get('nid').blocked(state), 'rejoins un village');
  });

  // --- Vie des villages ---

  test('chaque village a son jardin, et ses lueurs ne récoltent que le leur', () => {
    const state = State.create(3);
    const a = village(state, { radius: 250, beings: { lueur: 3 } });
    const b = village(state, { x: 2500, radius: 250 });
    state.player.x = 50000;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    for (const p of game.garden.particles) {
      const home = p.village === a.id ? a : b;
      assert.ok(Territory.contains(home, p.x, p.y), 'chaque particule naît dans son village');
    }
    assert.ok(game.garden.particles.some((p) => p.village === b.id));
    run(game, 20);
    for (const being of game.colony.beings) {
      if (being.target) assert.equal(being.target.village, a.id);
      assert.ok(Math.hypot(being.x - a.x, being.y - a.y) < 400, 'les lueurs restent chez elles');
    }
    assert.ok(a.rate > 0, 'le rendement est mesuré par village');
    assert.equal(b.rate, 0);
  });

  test('les êtres naissent, vivent et se rallument au cœur de leur village', () => {
    const state = State.create(3);
    const v = village(state, { x: -3000, y: 2000, radius: 200, beings: { gardien: 1 } });
    state.player.x = 50000;
    const game = Sim.create(state);
    const g = game.colony.beings[0];
    assert.ok(Math.hypot(g.x - v.x, g.y - v.y) < 40);
    Combat.hurtBeing(game, g, 1e6);
    g.x = g.y = 0;
    run(game, CONFIG.colony.downTime + 1);
    assert.ok(Math.hypot(g.x - v.x, g.y - v.y) < 300, 'rallumé chez lui');
  });

  test('une marée vise un village et marche vers son cœur', () => {
    const state = State.create(9);
    village(state, { radius: 300 });
    const far = village(state, { x: 6000, radius: 300 });
    state.player.x = 50000;
    const game = Sim.create(state);
    Shadows.startTide(game, far);
    for (const s of game.shadows.list) {
      assert.equal(s.home, far);
      const d = Math.hypot(s.x - far.x, s.y - far.y);
      assert.ok(d > 300 + 300 && d < 300 + CONFIG.shadows.tideDistance + 200, `distance ${d}`);
    }
    const s = game.shadows.list[0];
    const before = Math.hypot(s.x - far.x, s.y - far.y);
    run(game, 2);
    assert.ok(Math.hypot(s.x - far.x, s.y - far.y) < before);
  });

  test('un bastion brûle les ombres plus vite qu’un village de jardins', () => {
    const burn = (type) => {
      const state = State.create(9);
      village(state, { radius: 400, type });
      state.player.x = 50000;
      const game = Sim.create(state);
      const s = Shadows.spawn(game, 'massive', 100, 0, 'roam');
      const hp = s.hp;
      Shadows.update(game, 1);
      return hp - s.hp;
    };
    assert.near(burn('bastion'), 2 * burn('jardins'), 1e-9);
  });

  test('dispersée, la lumière renaît au cœur du village le plus proche', () => {
    const state = State.create(2);
    village(state);
    const near = village(state, { x: 5000, y: 5000, type: 'sanctuaire' });
    const game = Sim.create(state);
    state.player.x = 4200;
    state.player.y = 4600;
    Combat.disperse(game);
    assert.equal(state.player.x, near.x);
    assert.equal(state.player.y, near.y);
    const e = game.events.find((x) => x.type === 'dispersed');
    assert.ok(e && e.from.x === 4200 && e.to.x === 5000 && e.village === 'sanctuaire');
    // Sans village, elle renaît à l'origine.
    const lone = Sim.create(State.create(2));
    lone.state.player.x = 900;
    Combat.disperse(lone);
    assert.equal(lone.state.player.x, 0);
  });

  test('en garde, chaque être de l’armée défend son propre village', () => {
    const state = State.create(2);
    const a = village(state, { radius: 200, beings: { gardien: 1 } });
    const b = village(state, { x: 4000, radius: 300, beings: { gardien: 1 } });
    const game = Sim.create(state);
    const [ga, gb] = game.colony.beings;
    assert.equal(Combat.anchor(game, ga).x, a.x);
    assert.equal(Combat.anchor(game, gb).x, b.x);
    assert.equal(Combat.anchor(game, gb).radius, 300 + 260);
  });

  test('Éveil précoce : les lueurs attendent dans le premier village fondé', () => {
    const state = State.create(1);
    state.legacy.earlyWake = 2;
    const first = village(state);
    const second = village(state, { x: 3000 });
    assert.equal(first.beings.lueur, 2);
    assert.equal(second.beings.lueur, undefined);
  });

  // --- Sauvegardes ---

  test('migration : l’ancien territoire devient le premier village, avec ses êtres et ses bâtiments', () => {
    const old = {
      format: 9,
      state: {
        light: 10, totalLight: 99,
        territory: { lit: true, area: 250000 },
        beings: { lueur: 3, batisseur: 1 },
        buildings: [{ type: 'nid', x: 10, y: 80, work: 40 }],
        colonyRate: 4.5,
      },
    };
    const result = Save.deserialize(JSON.stringify(old));
    assert.ok(result.ok);
    const s = result.state;
    assert.equal(s.villages.length, 1);
    const v = s.villages[0];
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
    assert.equal(v.area, 250000);
    assert.equal(v.type, 'jardins');
    assert.deepEqual(v.beings, { lueur: 3, batisseur: 1 });
    assert.deepEqual(v.buildings, [{ type: 'nid', x: 10, y: 80, work: 40 }]);
    assert.equal(v.rate, 4.5);
    assert.equal('territory' in s || 'beings' in s || 'buildings' in s || 'colonyRate' in s, false);
    // Un foyer jamais allumé : pas de village.
    const unlit = Save.deserialize(JSON.stringify({ format: 9, state: { territory: { lit: false, area: 0 } } }));
    assert.deepEqual(unlit.state.villages, []);
  });

  test('les villages sauvegardés sont nettoyés', () => {
    const start = Math.PI * CONFIG.territory.startRadius ** 2;
    const s = Save.sanitize({
      villages: [
        { id: 1, type: 'bastion', x: 5, y: 6, area: 1e5, beings: { lueur: 2, fantome: 4, gardien: -1 }, rate: 3,
          buildings: [{ type: 'nid', x: 1, y: 2, work: 5000 }, { type: 'inconnu', x: 0, y: 0 }, 'x'] },
        { id: 1, type: 'jardins', x: 0, y: 0 },          // identifiant en double
        { id: 2, type: 'temple', x: 9, y: 9, area: -5 }, // type inconnu, surface abîmée
        { id: 'trois', x: 0, y: 0 }, { id: 4, x: NaN, y: 0 }, null, 7,
      ],
    });
    assert.equal(s.villages.length, 2);
    const [a, b] = s.villages;
    assert.deepEqual(a.beings, { lueur: 2 });
    assert.equal(a.buildings.length, 1);
    assert.equal(a.buildings[0].work, Structures.def('nid').work);
    assert.equal(a.rate, 3);
    assert.equal(b.type, 'jardins');
    assert.equal(b.area, start);
    assert.deepEqual(Save.sanitize({ villages: 'n’importe quoi' }).villages, []);
    const many = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, x: i * 1000, y: 0 }));
    assert.equal(Save.sanitize({ villages: many }).villages.length, CONFIG.villages.max);
  });

  test('une partie à plusieurs villages se sauvegarde et se recharge à l’identique', () => {
    const state = State.create(4);
    village(state, { radius: 300, beings: { lueur: 2 }, type: 'atelier' });
    const b = village(state, { x: -2000, radius: 150, beings: { gardien: 1 }, type: 'sanctuaire' });
    b.buildings.push({ type: 'tour', x: -2000, y: 100, work: 10 });
    const result = Save.deserialize(Save.serialize(state, 1));
    assert.ok(result.ok);
    assert.deepEqual(result.state, state);
  });
})();
