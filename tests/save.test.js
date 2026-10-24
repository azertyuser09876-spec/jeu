(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { State, Save } = Vide;

  function sampleState() {
    const state = State.create(1234);
    state.light = 42.5;
    state.totalLight = 900;
    state.upgrades = { reach: 3, value: 7 };
    state.player = { x: -120.5, y: 64 };
    state.stats = { playTime: 321.5, collected: 88, shadows: 4 };
    return state;
  }

  test('sauvegarder puis charger redonne le même état', () => {
    const state = sampleState();
    const result = Save.deserialize(Save.serialize(state, 1000));
    assert.ok(result.ok);
    assert.deepEqual(result.state, state);
    assert.equal(result.savedAt, 1000);
  });

  test('la sauvegarde indique le format et la version du jeu', () => {
    const raw = JSON.parse(Save.serialize(State.create(1), 0));
    assert.equal(raw.format, Save.FORMAT);
    assert.equal(raw.game, Vide.VERSION);
  });

  test('une sauvegarde illisible est refusée sans planter', () => {
    for (const text of ['', '{', 'null', '42', '[]', '{"format":1}', '{"format":"1","state":{}}', '{"format":0,"state":{}}']) {
      const result = Save.deserialize(text);
      assert.equal(result.ok, false, text);
      assert.equal(result.reason, 'corrupt', text);
    }
  });

  test("une sauvegarde d'une version plus récente est refusée", () => {
    const text = JSON.stringify({ format: Save.FORMAT + 1, state: {} });
    assert.equal(Save.deserialize(text).reason, 'newer');
  });

  test('les migrations sont appliquées dans l’ordre', () => {
    const migrations = {
      1: (d) => ({ ...d, light: d.light + 1, trace: ['1→2'] }),
      2: (d) => ({ ...d, light: d.light * 10, trace: d.trace.concat('2→3') }),
    };
    const text = JSON.stringify({ format: 1, state: { light: 4 } });
    const result = Save.deserialize(text, migrations, 3);
    assert.ok(result.ok);
    assert.equal(result.state.light, 50);
  });

  test('une migration manquante ou en erreur est signalée', () => {
    const text = JSON.stringify({ format: 1, state: {} });
    assert.equal(Save.deserialize(text, {}, 2).reason, 'migration');
    const broken = { 1: () => { throw new Error('boum'); } };
    assert.equal(Save.deserialize(text, broken, 2).reason, 'migration');
  });

  test('les valeurs absurdes reprennent leur valeur par défaut', () => {
    const state = Save.sanitize({
      light: -5,
      totalLight: 'beaucoup',
      player: { x: NaN, y: Infinity },
      stats: { playTime: null, collected: -3 },
      upgrades: 'rien',
    });
    assert.equal(state.light, 0);
    assert.equal(state.totalLight, 0);
    assert.equal(state.player.x, 0);
    assert.equal(state.player.y, 0);
    assert.equal(state.stats.playTime, 0);
    assert.equal(state.stats.collected, 0);
    assert.deepEqual(state.upgrades, {});
  });

  test('les niveaux sont bornés et les améliorations inconnues ignorées', () => {
    const maxReach = Vide.Economy.get('reach').max;
    const state = Save.sanitize({
      upgrades: { reach: 9999, speed: 2.5, density: -1, value: 12, inventee: 4 },
    });
    assert.deepEqual(state.upgrades, { reach: maxReach, value: 12 });
  });

  test('le total récolté ne peut pas être inférieur à la lumière possédée', () => {
    const state = Save.sanitize({ light: 500, totalLight: 10 });
    assert.equal(state.totalLight, 500);
  });

  test('une sauvegarde de la 0.1 (format 1) se charge sans rien perdre', () => {
    const v01 = {
      format: 1,
      game: '0.1.0',
      savedAt: 5,
      state: {
        seed: 9, light: 77, totalLight: 500, upgrades: { reach: 4, pulse: 2 },
        player: { x: 10, y: -20 }, stats: { playTime: 600, collected: 321 },
      },
    };
    const result = Save.deserialize(JSON.stringify(v01));
    assert.ok(result.ok);
    assert.equal(result.state.light, 77);
    assert.deepEqual(result.state.upgrades, { reach: 4, pulse: 2 });
    assert.deepEqual(result.state.territory, { lit: false, area: 0 });
  });

  test('le territoire est relu et nettoyé', () => {
    const start = Math.PI * Vide.CONFIG.territory.startRadius ** 2;
    assert.deepEqual(Save.sanitize({ territory: { lit: true, area: 99999 } }).territory, { lit: true, area: 99999 });
    assert.equal(Save.sanitize({ territory: { lit: true, area: -4 } }).territory.area, start);
    assert.deepEqual(Save.sanitize({ territory: { lit: 'oui', area: 500 } }).territory, { lit: false, area: 0 });
  });

  test('un état vide donne une partie neuve', () => {
    assert.deepEqual(Save.sanitize({ seed: 5 }), State.create(5));
  });
})();
