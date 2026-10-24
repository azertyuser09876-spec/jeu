(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Zones, ZONES, Field, Stats, Sim, Shadows, Territory, Save } = Vide;
  const dt = CONFIG.step;
  const SEED = 21;

  // Centre d'une région d'un type donné (recherche en spirale autour de l'origine).
  function findZone(seed, id, minDist) {
    for (let r = 0; r < 30; r++) {
      for (let i = -r; i <= r; i++) {
        for (let j = -r; j <= r; j++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
          if (Zones.typeOf(i, j, seed) !== id) continue;
          const c = Zones.center(i, j, seed);
          if (Math.hypot(c.x, c.y) < (minDist || 0)) continue;
          // On vérifie que le centre appartient bien à sa propre région.
          if (Zones.at(seed, c.x, c.y).key === `${i},${j}`) return c;
        }
      }
    }
    throw new Error(`zone ${id} introuvable`);
  }

  function gameAt(x, y) {
    const state = State.create(SEED);
    state.player.x = x;
    state.player.y = y;
    return Sim.create(state);
  }

  test('les régions sont stables pour une même graine', () => {
    for (const [x, y] of [[0, 0], [5000, -3000], [-20000, 7000]]) {
      assert.deepEqual(Zones.at(SEED, x, y), Zones.at(SEED, x, y));
    }
  });

  test('le foyer est toujours dans le Calme, pour toute graine', () => {
    for (let seed = 1; seed < 40; seed++) {
      assert.equal(Zones.at(seed, 0, 0).zone.id, 'calme', `graine ${seed}`);
      assert.equal(Zones.at(seed, 800, -600).zone.id, 'calme', `graine ${seed} près du foyer`);
    }
  });

  test('loin du foyer, le vide devient plus varié et plus dangereux', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const a = i * 2.4, d = 20000 + (i % 7) * 3000;
      const z = Zones.at(SEED, Math.cos(a) * d, Math.sin(a) * d).zone;
      seen.add(z.id);
      assert.ok(z.id !== 'calme', 'pas de Calme très loin');
    }
    assert.ok(seen.has('gouffre') && seen.has('eclat'));
  });

  test('chaque zone du catalogue est atteignable et cohérente', () => {
    for (const z of ZONES) {
      assert.ok(z.density > 0 && z.rare >= 1 && z.echoes >= 1 && z.fog >= 0 && z.fog <= 1, z.id);
      for (const k of Object.keys(z.kinds)) Shadows.kind(k);
      findZone(SEED, z.id);
    }
  });

  test('une région a une frontière positive et un courant propre à sa zone', () => {
    const c = findZone(SEED, 'courants');
    const region = Zones.at(SEED, c.x, c.y);
    assert.ok(region.edge > 0);
    assert.near(Math.hypot(region.current.x, region.current.y), Zones.get('courants').current, 1e-9);
    const calm = Zones.at(SEED, 0, 0);
    assert.deepEqual(calm.current, { x: 0, y: 0 });
  });

  test('visiter une région la note une fois ; un nouveau type est une découverte', () => {
    const state = State.create(SEED);
    const region = Zones.at(SEED, 0, 0);
    assert.equal(Zones.visit(state, region), true);
    assert.equal(Zones.visit(state, region), false);
    assert.deepEqual(state.zones.visited, [region.key]);
    assert.deepEqual(state.zones.discovered, ['calme']);
  });

  test('un courant emporte la lumière, pas les particules ni les villages (le monde ne file pas à l’écran)', () => {
    // Un village posé dans une région de courant, la lumière en son cœur, immobile.
    const c = findZone(SEED, 'courants');
    const state = State.create(SEED);
    state.player.x = c.x;
    state.player.y = c.y;
    const v = Vide.Villages.found(state, 'jardins');
    const game = Sim.create(state);
    const before = game.field.particles.slice(0, 50).map((p) => ({ p, x: p.x, y: p.y }));
    for (let i = 0; i < 60 * 3; i++) Sim.step(game, dt, Sim.emptyInput());
    const carried = Math.hypot(state.player.x - c.x, state.player.y - c.y);
    assert.ok(carried > Zones.get('courants').current * 2, `la lumière est emportée (${Math.round(carried)})`);
    assert.deepEqual([v.x, v.y], [c.x, c.y], 'le village ne bouge pas');
    // Les particules libres ne dérivent qu'à leur lente vitesse propre, pas avec le courant.
    for (const { p, x, y } of before) {
      if (p.gone || p.caught >= 0) continue;
      assert.ok(Math.hypot(p.x - x, p.y - y) < CONFIG.field.drift * 1.5 * 3 + 1, 'une particule ne suit pas le courant');
    }
  });

  test("entrer dans une nouvelle zone est annoncé", () => {
    const c = findZone(SEED, 'brume');
    const game = gameAt(0, 0);
    game.state.player.x = c.x;
    game.state.player.y = c.y;
    Sim.step(game, dt, Sim.emptyInput());
    assert.ok(game.events.some((e) => e.type === 'zoneDiscovered' && e.zone === 'brume'));
    assert.ok(game.events.some((e) => e.type === 'zoneEnter' && e.zone === 'brume'));
    assert.ok(game.state.zones.discovered.includes('brume'));
  });

  test('un courant emporte la lumière immobile', () => {
    const c = findZone(SEED, 'courants');
    const game = gameAt(c.x, c.y);
    for (let i = 0; i < 60; i++) Sim.step(game, dt, Sim.emptyInput());
    const moved = Math.hypot(game.state.player.x - c.x, game.state.player.y - c.y);
    assert.near(moved, Zones.get('courants').current, 5);
  });

  test('une zone dense remplit davantage le champ', () => {
    const stats = Stats.compute(State.create(1));
    const brume = Zones.get('brume');
    assert.ok(Field.targetCount(stats, brume) > Field.targetCount(stats) * 1.5);
  });

  test('pas d’ombre errante dans le Calme, même loin du territoire', () => {
    const game = gameAt(1500, 0);
    for (let i = 0; i < 60 * 90; i++) Sim.step(game, dt, Sim.emptyInput());
    assert.equal(game.shadows.list.length, 0);
  });

  test('le Murmure fait errer des ombres, qui y laissent plus d’échos', () => {
    const c = findZone(SEED, 'murmure');
    const game = gameAt(c.x, c.y);
    for (let i = 0; i < 60 * 60 && !game.shadows.list.length; i++) Sim.step(game, dt, Sim.emptyInput());
    assert.ok(game.shadows.list.length > 0, 'une ombre doit errer');
    const s = game.shadows.list[0];
    assert.equal(s.echoMult, Zones.get('murmure').echoes);
    s.hp = 0;
    const before = game.state.echoes;
    Sim.step(game, dt, Sim.emptyInput());
    assert.near(game.state.echoes - before, Shadows.kind(s.kind).echoes * Zones.get('murmure').echoes, 1e-9);
  });

  test('pickKind respecte les poids', () => {
    assert.equal(Shadows.pickKind({ errante: 1 }, 0.99), 'errante');
    assert.equal(Shadows.pickKind({ errante: 1, massive: 1 }, 0.2), 'errante');
    assert.equal(Shadows.pickKind({ errante: 1, massive: 1 }, 0.7), 'massive');
  });

  test('une sauvegarde de la 0.5 (format 5) se charge, sans région visitée', () => {
    const result = Save.deserialize(JSON.stringify({ format: 5, state: { echoes: 7 } }));
    assert.ok(result.ok);
    assert.deepEqual(result.state.zones, { visited: [], discovered: [] });
    assert.equal(result.state.echoes, 7);
  });

  test('les régions sauvegardées sont nettoyées', () => {
    const state = Save.sanitize({
      zones: { visited: ['0,0', '3,-2', '3,-2', 'n,importe', 42, '-1,7'], discovered: ['calme', 'abime', 'brume', 'calme'] },
    });
    assert.deepEqual(state.zones.visited, ['0,0', '3,-2', '-1,7']);
    assert.deepEqual(state.zones.discovered, ['calme', 'brume']);
  });

  test('le territoire reste calme : les zones ne touchent pas la colonie', () => {
    assert.equal(Zones.at(SEED, 0, 0).zone.id, 'calme');
  });
})();
