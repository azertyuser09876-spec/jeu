(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Sim, Colossus, Expeditions, Offline, Save, Renaissance } = Vide;
  const dt = CONFIG.step;

  function run(game, seconds, input) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, input || Sim.emptyInput());
  }

  // Le Veilleur entendu, la lumière à `dist` de lui ; `studied` sceaux déjà dévoilés.
  function facing(dist, studied) {
    const state = State.create(31);
    village(state, { radius: 300 });
    state.stats.shadows = 15;
    state.light = state.totalLight = 1e6;
    if (studied) state.studied.veilleur = studied;
    const game = Sim.create(state);
    game.field.particles.length = 0;
    run(game, dt);
    const c = game.colossi[0];
    state.player.x = c.x + dist;
    state.player.y = c.y;
    run(game, 0.1);
    return { state, game, c };
  }

  // Tient la lumière immobile pendant `seconds` (un courant pourrait l'emporter).
  function hold(game, seconds) {
    const { player } = game.state;
    const spot = { x: player.x, y: player.y };
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      player.x = spot.x;
      player.y = spot.y;
      game.velocity.x = game.velocity.y = 0;
      Sim.step(game, dt, Sim.emptyInput());
    }
  }

  // --- Taille ---

  test('les colosses sont immenses : bien plus grands que ton plus grand village de départ', () => {
    const { c } = facing(1200, 3);
    assert.ok(Colossus.extent(c) > 500, `envergure ${Colossus.extent(c)}`);
    for (const d of Vide.COLOSSI) assert.ok(d.size >= 1.9, d.id);
    // Leurs attaques grandissent avec eux.
    assert.ok(Colossus.reach(c) > 1.5);
  });

  // --- Sceaux voilés ---

  test('un sceau voilé ne se brise pas : la pulsation n’y fait rien, un message le dit', () => {
    const { state, game, c } = facing(500, 0);
    const found = game.events.find((e) => e.type === 'colossusFound');
    assert.ok(found && found.veiled, 'la rencontre annonce des sceaux voilés');
    assert.equal(Colossus.sealHit(game, c, 1e6), false);
    assert.equal(c.seals[0].hp, c.seals[0].max);
    assert.ok(game.events.some((e) => e.type === 'veiled'));
    // Étudié : le premier se brise, le deuxième reste voilé.
    Colossus.study(state, 'veilleur');
    assert.ok(Colossus.sealHit(game, c, 1e6));
    assert.equal(c.active, 1);
    const phase = game.events.find((e) => e.type === 'phase');
    assert.ok(phase && phase.veiled, 'le sceau suivant est encore voilé');
    assert.equal(Colossus.sealHit(game, c, 1e6), false);
    assert.equal(c.active, 1);
  });

  test('les coups de l’armée le font plier même voilé', () => {
    const { game, c } = facing(500, 0);
    Colossus.hit(game, c, c.def.stagger + 1);
    assert.equal(c.mode, 'kneel');
  });

  test('étudier : jamais plus de sceaux qu’il n’en a', () => {
    const state = State.create(1);
    for (let k = 0; k < 10; k++) Colossus.study(state, 'veilleur');
    assert.equal(Colossus.revealed(state, 'veilleur'), 3);
    assert.equal(Colossus.study(state, 'veilleur'), false);
  });

  // --- Érudits ---

  function scholarsReady() {
    const state = State.create(31);
    village(state, { radius: 300 });
    state.light = state.totalLight = 1e7;
    state.colossi.veilleur = 'heard';
    return state;
  }

  test('des érudits partent observer un colosse : chaque étude dévoile un sceau, puis ils rentrent', () => {
    const state = scholarsReady();
    const at = Colossus.lair(state, Colossus.def('veilleur'));
    assert.equal(Expeditions.studyable(state, at.x + 300, at.y, 2000), 'veilleur');
    assert.equal(Expeditions.studyable(state, 0, 0, 2000), null, 'loin de tout colosse');
    const spot = Expeditions.studySpot(state, 'veilleur');
    assert.near(Math.hypot(spot.x - at.x, spot.y - at.y), CONFIG.expeditions.studyRange, 1);
    assert.equal(Expeditions.blocked(state, 'scholars', spot.x, spot.y, false, null), 'aucun colosse à étudier ici');
    const light = state.light;
    const exp = Expeditions.launch(state, 'scholars', spot.x, spot.y, { colossus: 'veilleur' });
    assert.ok(exp && exp.members.erudit === CONFIG.expeditions.scholars);
    assert.ok(state.light < light);
    assert.equal(Expeditions.blocked(state, 'scholars', spot.x, spot.y, false, 'veilleur'), 'des érudits l’étudient déjà');

    const game = Sim.create(state);
    state.player.x = 0;
    const travel = Math.hypot(spot.x, spot.y) / CONFIG.expeditions.speed;
    for (let i = 0; i < Math.round((travel + 1) / dt); i++) {
      game.shadows.list.length = 0; // (les ombres du chemin ont leurs propres tests)
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(game.events.some((e) => e.type === 'studying') || exp.study !== null, 'arrivés à l’abri');
    assert.equal(Colossus.revealed(state, 'veilleur'), 0);
    for (let i = 0; i < Math.round((CONFIG.expeditions.studyTime + 1) / dt); i++) {
      game.shadows.list.length = 0;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.equal(Colossus.revealed(state, 'veilleur'), 1);
    assert.ok(game.events.some((e) => e.type === 'studied' && e.revealed === 1 && e.total === 3));
    // Le reste pendant l'absence : ils finissent, puis rentrent.
    Offline.apply(state, CONFIG.expeditions.studyTime * 2 + travel + 10);
    assert.equal(Colossus.revealed(state, 'veilleur'), 3);
    assert.equal(state.expeditions.length, 0, 'rentrés');
  });

  test('un village qui a du savoir étudie deux fois plus vite', () => {
    const state = scholarsReady();
    const spot = Expeditions.studySpot(state, 'veilleur');
    const exp = Expeditions.launch(state, 'scholars', spot.x, spot.y, { colossus: 'veilleur' });
    exp.x = exp.tx;
    exp.y = exp.ty;
    exp.study = 0;
    Expeditions.observe(state, exp, CONFIG.expeditions.studyTime * 0.6);
    assert.equal(Colossus.revealed(state, 'veilleur'), 0);
    state.villages[0].stock.savoir = 10;
    Expeditions.observe(state, exp, CONFIG.expeditions.studyTime * 0.3);
    assert.equal(Colossus.revealed(state, 'veilleur'), 1);
  });

  test('un colosse apaisé n’a plus rien à apprendre : les érudits rentrent', () => {
    const state = scholarsReady();
    const spot = Expeditions.studySpot(state, 'veilleur');
    const exp = Expeditions.launch(state, 'scholars', spot.x, spot.y, { colossus: 'veilleur' });
    exp.study = 0;
    state.colossi.veilleur = 'tamed';
    Expeditions.observe(state, exp, 1);
    assert.ok(exp.back);
    assert.equal(Expeditions.studyable(state, spot.x, spot.y, 5000), null);
  });

  // --- Phases ---

  test('chaque sceau brisé ouvre une phase : rugissement (séisme), attaque en plus, plus rapide', () => {
    const { game, c } = facing(500, 3);
    assert.deepEqual(Colossus.attacksOf(c), ['stomp', 'breath']);
    Colossus.hit(game, c, c.def.stagger + 1);
    assert.equal(c.mode, 'kneel');
    Colossus.sealHit(game, c, 1e6);
    assert.equal(c.mode, 'hunt', 'il se redresse');
    assert.equal(c.attack.kind, 'quake');
    assert.ok(game.events.some((e) => e.type === 'phase' && e.phase === 1));
    assert.deepEqual(Colossus.attacksOf(c), ['stomp', 'breath', 'quake']);
    const slow = c.attack.telegraph;
    Colossus.sealHit(game, c, 1e6);
    assert.ok(c.attack.telegraph < slow, 'annoncée plus tard');
    assert.deepEqual(Colossus.attacksOf(c), ['stomp', 'breath', 'quake', 'sweep']);
  });

  test('le séisme frappe la lumière que son anneau traverse, pas celle qui se tient dans une brèche', () => {
    const hurtAt = (inGap) => {
      const { state, game, c } = facing(900, 3);
      c.attackCd = 99;
      game.vitality.invulnerable = 0;
      Colossus.startAttack(game, c, 'quake');
      const atk = c.attack;
      const a = Math.atan2(state.player.y - atk.origin.y, state.player.x - atk.origin.x);
      // Une brèche pile sur la lumière, ou toutes loin d'elle.
      atk.gaps = inGap ? [a] : [a + Math.PI];
      const d = Math.hypot(state.player.x - atk.origin.x, state.player.y - atk.origin.y);
      assert.ok(d < atk.length, 'à portée');
      const hp = game.vitality.hp;
      hold(game, atk.telegraph + d / Colossus.ATTACKS.quake.speed + 0.3);
      return hp - game.vitality.hp;
    };
    assert.ok(hurtAt(false) >= Colossus.ATTACKS.quake.damage - 1e-9);
    assert.ok(hurtAt(true) < 1e-9);
  });

  test('le balayage tourne d’un bord à l’autre de son arc', () => {
    const { state, game, c } = facing(600, 3);
    c.attackCd = 99;
    game.vitality.invulnerable = 0;
    Colossus.startAttack(game, c, 'sweep');
    const atk = c.attack;
    const start = atk.dir;
    assert.equal(Colossus.inCone(atk, state.player.x, state.player.y), false, 'au départ, il vise à côté');
    const hp = game.vitality.hp;
    hold(game, atk.telegraph + Colossus.ATTACKS.sweep.active * 0.6);
    assert.ok(Math.abs(c.attack ? c.attack.dir - start : 1) > 0.5, 'il a tourné');
    assert.ok(game.vitality.hp <= hp - Colossus.ATTACKS.sweep.damage + 1e-9, 'touché au passage');
  });

  test('la pluie de toiles en tisse trois d’un coup', () => {
    const state = State.create(31);
    village(state, { radius: 300 });
    state.colossi.veilleur = 'tamed';
    state.colossi.tisseuse = 'heard';
    const game = Sim.create(state);
    const c = game.colossi.find((k) => k.id === 'tisseuse');
    state.player.x = c.x + 600;
    state.player.y = c.y;
    run(game, 0.1);
    c.attackCd = 99;
    Colossus.startAttack(game, c, 'volley');
    hold(game, c.attack.telegraph + 0.05);
    assert.equal(game.webs.length, 3);
  });

  // --- Sauvegarde ---

  test('sceaux étudiés : sauvegardés, nettoyés, gardés à la renaissance ; migration', () => {
    const state = State.create(1);
    state.studied.veilleur = 2;
    assert.deepEqual(Save.deserialize(Save.serialize(state, 1)).state.studied, { veilleur: 2 });
    const bad = Save.sanitize({ studied: { veilleur: 99, tisseuse: -1, leviathan: 'x', inconnu: 2 } });
    assert.deepEqual(bad.studied, { veilleur: 3 });
    const old = Save.deserialize(JSON.stringify({ format: 17, state: { colossi: { veilleur: 'found', tisseuse: 'heard' } } })).state;
    assert.deepEqual(old.studied, { veilleur: 3 }, 'un colosse déjà rencontré garde ses sceaux visibles');
    // Des érudits en route se relisent ; sans colosse connu, ils disparaissent.
    const exps = Save.sanitize({
      expeditions: [
        { id: 1, kind: 'scholars', colossus: 'veilleur', x: 0, y: 0, tx: 5, ty: 5, members: { erudit: 2 }, study: 12 },
        { id: 2, kind: 'scholars', colossus: 'personne', x: 0, y: 0, tx: 5, ty: 5, members: { erudit: 2 } },
      ],
    }).expeditions;
    assert.equal(exps.length, 1);
    assert.equal(exps[0].study, 12);
    state.totalLight = 1e9;
    Renaissance.perform(state);
    assert.deepEqual(state.studied, { veilleur: 2 });
  });
})();
