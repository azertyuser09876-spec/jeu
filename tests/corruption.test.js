(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Colossus, Corruption, Nests, War, Save, Stats } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, each) {
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      Sim.step(game, dt, Sim.emptyInput());
      if (each) each();
    }
  }

  // Le Veilleur apaisé, près d'un village ; une base mûre à portée ; la lumière loin.
  function world() {
    const state = State.create(31);
    const v = village(state, { radius: 400, beings: { gardien: 4 } });
    state.colossi.veilleur = 'tamed';
    const nest = Nests.add(state, 4000, 0, CONFIG.nests.levelEvery * CONFIG.colossi.corruptLevel);
    state.player.x = -30000;
    return { state, v, nest };
  }

  const openWar = (state, rude) => {
    War.begin(state);
    state.war.age = rude ? 1e9 : CONFIG.war.ramp;
  };

  test('sans guerre ouverte, rien ne ronge un colosse apaisé ; en guerre, les bases mûres à portée le rongent', () => {
    const { state, nest } = world();
    const game = Sim.create(state);
    const c = game.colossi[0];
    assert.equal(Corruption.rate(state, c.x, c.y), 0, 'pas de guerre');
    War.begin(state);
    assert.equal(Corruption.rate(state, c.x, c.y), 0, 'la tension');
    openWar(state);
    const r = Corruption.rate(state, c.x, c.y);
    assert.ok(r > 0);
    run(game, 10);
    assert.ok(state.corruption.veilleur > 0 && c.corrupt > 0, 'il s’assombrit');
    // Trop loin, ou trop jeune : rien.
    nest.age = 0;
    assert.equal(Corruption.rate(state, c.x, c.y), 0);
  });

  test('rongé jusqu’au bout, il est corrompu : sans rôle ni bienfait, hostile, il marche sur ton village', () => {
    const { state, v } = world();
    openWar(state, true);
    const game = Sim.create(state);
    const c = game.colossi[0];
    const boon = Stats.compute(state);
    state.corruption.veilleur = 0.999;
    const seen = [];
    run(game, 1, () => {
      for (const e of game.events) seen.push(e.type);
      game.events.length = 0;
    });
    assert.equal(Colossus.status(state, 'veilleur'), 'corrupted');
    assert.ok(seen.includes('colossusCorrupted') && seen.includes('march'));
    assert.equal(c.mode, 'march');
    assert.equal(c.march.village, v.id);
    assert.ok(Colossus.hostile(c) && c.corrupt === 1 && c.calm === 0);
    assert.ok(c.seals.every((s) => s.hp === s.max), 'ses sceaux sont entiers');
    assert.ok(JSON.stringify(Stats.compute(state)) !== JSON.stringify(boon), 'son bienfait est perdu');
    assert.equal(state.corruption.veilleur, undefined);
  });

  test('ta pulsation purifie un colosse rongé ; on reprend un colosse corrompu en l’apaisant de nouveau', () => {
    const { state } = world();
    openWar(state);
    const game = Sim.create(state);
    const c = game.colossi[0];
    state.corruption.veilleur = 0.6;
    state.player.x = c.core.x + 60;
    state.player.y = c.core.y;
    Sim.pulse(game);
    let purified = false;
    run(game, 2, () => {
      purified = purified || game.events.some((e) => e.type === 'purified');
      game.events.length = 0;
    });
    assert.ok(purified);
    assert.ok(state.corruption.veilleur < 0.6 - CONFIG.colossi.purify + 0.05);
    // Corrompu, puis repris.
    Corruption.corrupt(game, c);
    game.events.length = 0;
    Colossus.tame(game, c);
    assert.equal(Colossus.status(state, 'veilleur'), 'tamed');
    assert.ok(game.events.some((e) => e.type === 'colossusRetaken'));
    assert.ok(!game.events.some((e) => e.type === 'colossusTamed'), 'pas un premier apaisement');
    assert.equal(c.corrupt, 0);
  });

  test('sauvegarde : un colosse corrompu le reste, et revient hostile à son repaire ; la jauge se garde, nettoyée', () => {
    const { state } = world();
    state.colossi.tisseuse = 'corrupted';
    state.corruption.veilleur = 0.4;
    const back = Save.deserialize(Save.serialize(state, 1)).state;
    assert.equal(back.colossi.tisseuse, 'corrupted');
    assert.equal(back.corruption.veilleur, 0.4);
    const game = Sim.create(back);
    const t = game.colossi.find((c) => c.id === 'tisseuse');
    assert.ok(t && t.mode === 'roam' && t.corrupt === 1);
    const bad = Save.sanitize({ colossi: { veilleur: 'tamed', tisseuse: 'found' }, corruption: { veilleur: 7, tisseuse: 0.5, dragon: 1 } });
    assert.deepEqual(bad.corruption, { veilleur: 0.99 });
    const old = JSON.parse(Save.serialize(state, 1));
    old.format = 27;
    delete old.state.corruption;
    assert.deepEqual(Save.deserialize(JSON.stringify(old)).state.corruption, {}, 'une ancienne partie : rien de rongé');
  });
})();
