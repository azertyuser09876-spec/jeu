(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Creatures, Nests, Catalog, Save, Combat } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, each) {
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      Sim.step(game, dt, Sim.emptyInput());
      if (each) each();
    }
  }

  // Un village d'une sous-faction, gardé ; la lumière loin.
  function world(faction, beings) {
    const state = State.create(23);
    state.faction = faction;
    const v = village(state, { radius: 400, beings: beings || { gardien: 6, etincelle: 3 } });
    state.stats.shadows = 5;
    state.player.x = -20000;
    return { state, v };
  }

  // Un loup des ombres lâché sur le village ; on suit ce qu'il devient (événements lus à chaque pas).
  function wolfAttack(faction) {
    const { state, v } = world(faction);
    const game = Sim.create(state);
    const wolf = Creatures.spawn(game, 'loup', 'shadow', null, v.x + 500, v.y);
    wolf.home = v;
    const seen = [];
    run(game, 60, () => {
      for (const e of game.events) if (e.type === 'converted' || e.type === 'creatureDown') seen.push(e);
      game.events.length = 0;
    });
    return { state, v, game, wolf, seen };
  }

  test('une bête des ombres attaque ; des Lames l’abattent (et en gagnent deux fois plus d’échos)', () => {
    const { state, game, wolf, seen } = wolfAttack('lames');
    assert.ok(!game.creatures.list.includes(wolf), 'abattue');
    const down = seen.find((e) => e.type === 'creatureDown');
    assert.ok(down);
    assert.near(down.echoes, Creatures.kind('loup').echoes * 2 * game.stats.echoGain, 1e-9);
    assert.ok(state.echoes >= down.echoes);
    assert.ok(!seen.some((e) => e.type === 'converted'));
  });

  test('des Éleveurs l’apprivoisent : à bout de forces, elle rejoint leur village et le défend', () => {
    const { v, game, wolf, seen } = wolfAttack('eleveurs');
    const turned = seen.find((e) => e.type === 'converted');
    assert.ok(turned, 'retournée');
    assert.equal(turned.to, 'light');
    assert.equal(wolf.side, 'light');
    assert.equal(wolf.owner, v);
    assert.equal(v.creatures.loup, 1);
    // Elle combat désormais pour lui.
    const s = Vide.Shadows.spawn(game, 'errante', v.x + 150, v.y, 'tide');
    s.home = v;
    let hurt = false;
    run(game, 15, () => { hurt = hurt || s.hp < s.maxHp; });
    assert.ok(hurt);
  });

  test('des Illuminés purifient les bêtes des ombres, mais pas la faune', () => {
    const { v, wolf, seen } = wolfAttack('illumines');
    assert.ok(seen.some((e) => e.type === 'converted' && e.faction === 'illumines'));
    assert.equal(wolf.owner, v);
    const f = Vide.Factions.def('illumines');
    assert.ok(f.convert.includes('shadow') && !f.convert.includes('wild'));
  });

  test('une base de Corrupteurs retourne les créatures de lumière ; des Dévoreurs se nourrissent', () => {
    const { state, v } = world('lames', {});
    v.creatures = { cerf: 1 };
    const nest = Nests.add(state, 3000, 0, 0);
    nest.faction = 'corrupteurs';
    const game = Sim.create(state);
    const cerf = game.creatures.list.find((c) => c.kind === 'cerf');
    assert.ok(cerf && cerf.side === 'light');
    // Ses bêtes le frappent jusqu'au bout de ses forces.
    const wolf = Creatures.spawn(game, 'loup', 'shadow', nest, cerf.x + 30, cerf.y);
    Creatures.hit(game, cerf, cerf.maxHp * 0.8, Creatures.by(wolf));
    assert.equal(cerf.side, 'shadow');
    assert.equal(cerf.owner, nest);
    assert.equal(nest.creatures.cerf, 1);
    assert.ok(!v.creatures.cerf);
    // Des Dévoreurs reprennent des forces en tuant.
    nest.faction = 'devoreurs';
    wolf.hp = 100;
    const prey = Creatures.spawn(game, 'loup', 'light', v, 0, 0);
    assert.equal(Creatures.hit(game, prey, 1e6, Creatures.by(wolf)), 'down');
    assert.ok(wolf.hp > 100);
  });

  test('ta pulsation frappe les bêtes des ombres ; avec tes Éleveurs, elle les apprivoise pour le village le plus proche', () => {
    const { state, v } = world('eleveurs', {});
    const game = Sim.create(state);
    state.player.x = 300;
    state.player.y = 0;
    const wolf = Creatures.spawn(game, 'loup', 'shadow', null, 360, 0);
    wolf.hp = wolf.maxHp * CONFIG.creatures.convertAt + 1;
    Sim.pulse(game);
    run(game, 1);
    assert.equal(wolf.side, 'light');
    assert.equal(wolf.owner, v);
  });

  test('les bases mûres ont une garnison de bêtes, et leurs raids lâchent des meutes (plus grosses chez les Meutes)', () => {
    const { state } = world('lames');
    const nest = Nests.add(state, 4000, 0, CONFIG.nests.levelEvery * 7);
    assert.ok(nest.creatures.loup >= 1);
    assert.equal(nest.creatures.scolopendre, 1);
    const game = Sim.create(state);
    assert.ok(game.creatures.list.filter((c) => c.owner === nest).length >= 2, 'la garnison est là');
    const pack = (faction) => {
      nest.faction = faction;
      let n = 0;
      for (let i = 0; i < 40; i++) n += Creatures.raid(game, nest, state.villages[0]);
      return n;
    };
    assert.ok(pack('meutes') > pack('devoreurs'));
  });

  test('le cerf de lumière s’achète, un par village (deux chez les Éleveurs)', () => {
    const { state, v } = world('lames');
    state.light = state.totalLight = 1e7;
    state.echoes = 1e4;
    state.player.x = 0;
    assert.ok(Catalog.get('cerf').revealed(state));
    assert.ok(Catalog.buy(state, 'cerf'));
    assert.equal(v.creatures.cerf, 1);
    assert.equal(Catalog.get('cerf').blocked(state), 'un cerf par village');
    v.faction = 'eleveurs';
    assert.ok(Catalog.buy(state, 'cerf'));
    assert.equal(Catalog.get('cerf').blocked(state), 'deux cerfs par village');
    const game = Sim.create(state);
    assert.equal(game.creatures.list.filter((c) => c.kind === 'cerf' && c.owner === v).length, 2);
  });

  test('sauvegarde : les créatures attachées se gardent ; nombres nettoyés', () => {
    const { state, v } = world('lames');
    v.creatures = { loup: 2, cerf: 1 };
    const nest = Nests.add(state, 4000, 0, CONFIG.nests.levelEvery * 5);
    const back = Save.deserialize(Save.serialize(state, 1)).state;
    assert.deepEqual(back.villages[0].creatures, { loup: 2, cerf: 1 });
    assert.deepEqual(back.nests[0].creatures, nest.creatures);
    const bad = Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, creatures: { cerf: 2.5, loup: 99, dragon: 1, scolopendre: -1 } }] });
    assert.deepEqual(bad.villages[0].creatures, { loup: 20 });
    assert.deepEqual(Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, creatures: 'x' }] }).villages[0].creatures, {});
  });
})();
