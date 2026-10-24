(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Stats, Territory, Sim, Colossus, Shadows, Save } = Vide;
  const dt = CONFIG.step;

  function ready() {
    const state = State.create(31);
    village(state, { radius: 300 });
    state.stats.shadows = 15;
    state.light = state.totalLight = 1e6;
    // Sceaux déjà étudiés (les sceaux voilés ont leurs propres tests).
    for (const d of Vide.COLOSSI) state.studied[d.id] = d.seals.length;
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

  // Partie où la lumière se tient à `dist` du Veilleur, déjà en chasse.
  function facing(dist) {
    const state = ready();
    const game = newGame(state);
    run(game, dt);
    const c = game.colossi[0];
    state.player.x = c.x + dist;
    state.player.y = c.y;
    return { state, game, c };
  }

  test('le Veilleur reste inconnu tant que la lumière n’a pas assez combattu', () => {
    const state = ready();
    state.stats.shadows = 3;
    const game = newGame(state);
    run(game, 1);
    assert.equal(Colossus.status(state, 'veilleur'), 'unknown');
    assert.equal(game.colossi.length, 0);
  });

  test('après assez d’ombres vaincues, on entend son battement et il existe à son repaire', () => {
    const state = ready();
    const game = newGame(state);
    run(game, dt);
    assert.equal(Colossus.status(state, 'veilleur'), 'heard');
    assert.ok(game.events.some((e) => e.type === 'heartbeat' && e.id === 'veilleur'));
    const c = game.colossi[0];
    const lair = Colossus.lair(state, Colossus.def('veilleur'));
    assert.near(Math.hypot(lair.x, lair.y), Colossus.def('veilleur').lair.distance, 1e-6);
    assert.ok(Math.hypot(c.x - lair.x, c.y - lair.y) < 1);
  });

  test('le repaire est stable pour une partie, différent d’une partie à l’autre', () => {
    const d = Colossus.def('veilleur');
    assert.deepEqual(Colossus.lair(State.create(5), d), Colossus.lair(State.create(5), d));
    const a = Colossus.lair(State.create(5), d), b = Colossus.lair(State.create(6), d);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1);
  });

  test('il marche par paires diagonales, sans jamais lever les deux paires à la fois', () => {
    const { game, c } = facing(900);
    let steps = 0;
    for (let i = 0; i < 60 * 20; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      const lifted = c.legs.map((l) => l.t >= 0);
      const pairA = lifted[0] || lifted[3], pairB = lifted[1] || lifted[2];
      assert.ok(!(pairA && pairB), 'deux paires levées en même temps');
      if (lifted.some(Boolean)) steps++;
    }
    assert.ok(steps > 30, 'il doit marcher');
  });

  test('un pied posé ne glisse pas', () => {
    const { game, c } = facing(900);
    run(game, 3);
    const leg = c.legs.find((l) => l.t < 0);
    const at = { ...leg.foot };
    Sim.step(game, dt, Sim.emptyInput());
    if (leg.t < 0) assert.deepEqual(leg.foot, at);
  });

  test('le genou respecte la longueur de la cuisse', () => {
    const { c } = facing(900);
    const hip = Colossus.toWorld(c, 65, -40);
    const foot = { x: hip.x + 60, y: hip.y - 90 };
    const k = Colossus.knee(c, hip, foot);
    assert.near(Math.hypot(k.x - hip.x, k.y - hip.y), c.body.thigh * c.def.size, 1e-6);
  });

  test('le genou est toujours tourné vers l’extérieur du corps', () => {
    const { c } = facing(900);
    for (const [hx, hy, fx, fy] of [[65, -40, 100, -105], [65, 40, 100, 105], [-45, -40, 40, -100], [-45, 40, -120, 90]]) {
      const hip = Colossus.toWorld(c, hx, hy);
      const foot = Colossus.toWorld(c, fx, fy);
      const k = Colossus.knee(c, hip, foot);
      const mid = { x: (hip.x + foot.x) / 2, y: (hip.y + foot.y) / 2 };
      assert.ok(Math.hypot(k.x - c.x, k.y - c.y) >= Math.hypot(mid.x - c.x, mid.y - c.y) - 1e-6);
    }
  });

  test('même en tournant sans cesse, aucune patte ne fouette', () => {
    for (const id of ['veilleur', 'tisseuse']) {
      const state = ready();
      if (id === 'tisseuse') state.colossi.veilleur = 'tamed';
      const game = newGame(state);
      run(game, dt);
      const c = game.colossi.find((k) => k.id === id);
      c.attackCd = 1e9; // pas d'attaque : on observe la marche
      const stride = c.body.stride * c.def.size;
      // Vitesse maximale d'un pied : un pas de 1,5 foulée en 0,75 temps de pas, pic ×1,5 de l'interpolation.
      const limit = (1.5 * stride) / (0.75 * c.body.stepTime) * 1.5 * dt + 1;
      let worst = 0;
      for (let i = 0; i < 60 * 20; i++) {
        const a = i * dt * 0.8; // la lumière tourne autour du colosse
        state.player.x = c.x + Math.cos(a) * 600;
        state.player.y = c.y + Math.sin(a) * 600;
        game.vitality.invulnerable = 0;
        const before = c.legs.map((l) => ({ ...l.foot }));
        Sim.step(game, dt, Sim.emptyInput());
        c.legs.forEach((l, k) => { worst = Math.max(worst, Math.hypot(l.foot.x - before[k].x, l.foot.y - before[k].y)); });
      }
      assert.ok(worst <= limit, `${id} : un pied a bougé de ${worst.toFixed(1)} en un pas (limite ${limit.toFixed(1)})`);
    }
  });

  test('il remarque la lumière qui approche : rencontre et chasse', () => {
    const { state, game, c } = facing(500);
    run(game, 0.1);
    assert.equal(c.mode, 'hunt');
    assert.equal(Colossus.status(state, 'veilleur'), 'found');
    assert.ok(game.events.some((e) => e.type === 'colossusFound'));
  });

  test('le piétinement est annoncé : on peut l’esquiver', () => {
    const { state, game, c } = facing(500);
    run(game, 0.1);
    game.vitality.invulnerable = 0;
    c.attackCd = 0;
    c.def.attacks.forEach(() => {});
    // Force un piétinement.
    const rng = c.rng;
    c.rng = () => 0;
    run(game, dt);
    c.rng = rng;
    assert.equal(c.attack && c.attack.kind, 'stomp');
    const hp = game.vitality.hp;
    // Pendant l'annonce, rien ne frappe ; on s'écarte de tous les cercles.
    run(game, 0.5);
    assert.equal(game.vitality.hp, hp);
    state.player.x += 600;
    run(game, 1.2);
    assert.ok(game.vitality.hp >= hp - 1e-9, 'esquivé : aucun dégât');
  });

  test('rester sous un piétinement fait mal', () => {
    const { state, game, c } = facing(500);
    run(game, 0.1);
    c.attackCd = 99; // pas d'autre attaque
    const spot = { x: state.player.x, y: state.player.y };
    c.attack = { kind: 'stomp', t: 0, phase: 'telegraph', points: [spot], radius: 75 };
    const hp = game.vitality.hp;
    // La lumière reste sur place (le repaire peut être dans un courant qui l'emporterait).
    for (let i = 0; i < Math.round((Colossus.ATTACKS.stomp.telegraph + 0.1) / dt); i++) {
      state.player.x = spot.x;
      state.player.y = spot.y;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(game.vitality.hp <= hp - Colossus.ATTACKS.stomp.damage + 1e-9);
  });

  test('le souffle frappe dans un cône', () => {
    const atk = { origin: { x: 0, y: 0 }, dir: 0, length: 650, spread: 0.3 };
    assert.ok(Colossus.inCone(atk, 300, 20));
    assert.equal(Colossus.inCone(atk, 300, 250), false);
    assert.equal(Colossus.inCone(atk, 800, 0), false);
    assert.equal(Colossus.inCone(atk, -100, 0), false);
  });

  test('la pulsation brise les sceaux dans l’ordre, un coup par onde', () => {
    const { game, c } = facing(400);
    run(game, 0.1);
    const first = c.seals[0];
    Colossus.sealHit(game, c, 10);
    assert.equal(first.hp, first.max - 10);
    assert.equal(c.seals[1].hp, c.seals[1].max, 'les autres sceaux sont intacts');
    Colossus.sealHit(game, c, 1e6);
    assert.ok(first.broken);
    assert.equal(c.active, 1);
    assert.ok(game.events.some((e) => e.type === 'sealBroken' && e.left === 2));
  });

  test("l'onde atteint le sceau actif seulement s'il est dans son rayon", () => {
    const { game, c } = facing(400);
    run(game, 0.1);
    const p = Colossus.sealPos(c);
    Sim.pulse(game);
    Colossus.pulseHit(game, p.x + 5000, p.y, 100);
    assert.equal(c.seals[0].hp, c.seals[0].max);
    Colossus.pulseHit(game, p.x + 50, p.y, 100);
    assert.equal(c.seals[0].hp, c.seals[0].max - game.stats.pulseDamage);
    Colossus.pulseHit(game, p.x + 50, p.y, 100);
    assert.equal(c.seals[0].hp, c.seals[0].max - game.stats.pulseDamage, 'une seule fois par onde');
  });

  test("les coups de l'armée le font plier ; à genou, ses sceaux prennent double", () => {
    const { game, c } = facing(400);
    run(game, 0.1);
    Colossus.hit(game, c, c.def.stagger + 1);
    assert.equal(c.mode, 'kneel');
    assert.ok(game.events.some((e) => e.type === 'kneel'));
    assert.equal(c.attack, null);
    Colossus.sealHit(game, c, 10);
    assert.equal(c.seals[0].hp, c.seals[0].max - 20);
    run(game, c.def.kneel + 0.2);
    assert.equal(c.mode, 'hunt');
  });

  test('un gardien en escorte frappe le colosse et remplit sa jauge', () => {
    const { state, game, c } = facing(420);
    state.villages[0].beings.gardien = 2;
    Vide.Combat.setPosture(state, 'escorte');
    run(game, dt);
    // Les gardiens naissent au cœur du village : on les amène directement près du colosse.
    for (const g of game.colony.beings) {
      g.x = state.player.x;
      g.y = state.player.y;
    }
    game.vitality.invulnerable = 1e9; // la lumière ne craint rien pendant le test
    // Les ombres errantes de la zone passeraient en priorité : on les écarte pour ce test,
    // et la lumière reste sur place (un courant pourrait l'emporter loin de la bataille).
    const spot = { x: state.player.x, y: state.player.y };
    for (let i = 0; i < 60 * 12; i++) {
      game.shadows.list.length = 0;
      state.player.x = spot.x;
      state.player.y = spot.y;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(c.stagger > 0 || c.mode === 'kneel', `jauge ${c.stagger}`);
  });

  test('tous les sceaux brisés : il s’apaise, rejoint le territoire et offre son bienfait', () => {
    const { state, game, c } = facing(400);
    run(game, 0.1);
    const growth = Stats.compute(state).territoryGrowth;
    for (let i = 0; i < c.seals.length; i++) Colossus.sealHit(game, c, 1e6);
    assert.equal(Colossus.status(state, 'veilleur'), 'tamed');
    assert.equal(c.mode, 'calm');
    assert.ok(game.events.some((e) => e.type === 'colossusTamed'));
    assert.near(Stats.compute(state).territoryGrowth, growth * 2, 1e-9);
    run(game, 7);
    assert.ok(c.mode === 'home' || c.mode === 'resident');
  });

  test('apaisé, il fait la ronde du territoire au chargement et ses pas écrasent les ombres', () => {
    const state = ready();
    state.colossi.veilleur = 'tamed';
    state.player.x = 50000;
    const game = newGame(state);
    const c = game.colossi[0];
    assert.equal(c.mode, 'resident');
    assert.near(Math.hypot(c.x, c.y), Territory.radius(state.villages[0]) + 250, 1);
    const s = Shadows.spawn(game, 'massive', c.legs[0].foot.x, c.legs[0].foot.y, 'tide');
    s.home = state.villages[0]; // une marée marche vers le village : sous les pas du Veilleur
    s.cd = 99;
    let hurt = false;
    for (let i = 0; i < 60 * 15 && !hurt; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      s.cd = 99;
      hurt = s.hp < s.maxHp - Colossus.FOOT.shadowDamage / 2 || !game.shadows.list.includes(s);
    }
    assert.ok(hurt, 'la massive sous ses pas doit être écrasée');
  });

  test('si la lumière s’éloigne, il renonce et ses sceaux se referment', () => {
    const { state, game, c } = facing(400);
    run(game, 0.1);
    Colossus.sealHit(game, c, 50);
    state.player.x = c.x + 5000;
    run(game, 0.2);
    assert.equal(c.mode, 'roam');
    run(game, 15);
    assert.equal(c.seals[0].hp, c.seals[0].max);
  });

  // --- La Tisseuse et le Léviathan ---

  // Partie où un colosse donné est déjà entendu, la lumière à `dist` de lui.
  function near(id, dist, tamedBefore) {
    const state = ready();
    for (const t of tamedBefore) state.colossi[t] = 'tamed';
    const game = newGame(state);
    run(game, dt);
    const c = game.colossi.find((k) => k.id === id);
    state.player.x = c.x + dist;
    state.player.y = c.y;
    return { state, game, c };
  }

  test('les colosses se méritent dans l’ordre : Veilleur, Tisseuse, Léviathan', () => {
    const state = ready();
    const game = newGame(state);
    run(game, dt);
    assert.deepEqual(game.colossi.map((c) => c.id), ['veilleur']);
    state.colossi.veilleur = 'tamed';
    run(game, dt);
    assert.equal(Colossus.status(state, 'tisseuse'), 'heard');
    assert.equal(Colossus.status(state, 'leviathan'), 'unknown');
    state.colossi.tisseuse = 'tamed';
    run(game, dt);
    assert.equal(Colossus.status(state, 'leviathan'), 'heard');
    assert.ok(game.events.some((e) => e.type === 'heartbeat' && e.id === 'leviathan'));
  });

  test('chaque colosse vit plus loin que tous ceux qu’il faut apaiser avant lui', () => {
    const state = State.create(8);
    state.stats.shadows = 1e6;
    const dist = (d) => Math.hypot(Colossus.lair(state, d).x, Colossus.lair(state, d).y);
    for (const d of Vide.COLOSSI) {
      for (const e of Vide.COLOSSI) {
        if (e === d) continue;
        // e est un préalable de d si, tous les autres apaisés, d reste muet tant que e ne l'est pas.
        for (const o of Vide.COLOSSI) state.colossi[o.id] = o === e ? 'found' : 'tamed';
        if (!d.requires(state)) assert.ok(dist(d) > dist(e), `${d.id} après ${e.id}`);
      }
    }
  });

  test('la Tisseuse marche à huit pattes, par tétrapodes alternés', () => {
    const { game, c } = near('tisseuse', 950, ['veilleur']);
    assert.equal(c.legs.length, 8);
    let moved = false;
    for (let i = 0; i < 60 * 15; i++) {
      Sim.step(game, dt, Sim.emptyInput());
      const lifted = c.legs.map((l) => l.t >= 0);
      const groupA = [0, 3, 4, 7].some((k) => lifted[k]), groupB = [1, 2, 5, 6].some((k) => lifted[k]);
      assert.ok(!(groupA && groupB), 'les deux tétrapodes ne se lèvent jamais ensemble');
      moved = moved || groupA || groupB;
    }
    assert.ok(moved);
  });

  test('une toile, annoncée, ralentit la lumière puis disparaît', () => {
    const { state, game, c } = near('tisseuse', 500, ['veilleur']);
    run(game, 0.1);
    c.attackCd = 99;
    c.attack = { kind: 'web', t: 0, phase: 'telegraph', at: { x: state.player.x, y: state.player.y }, radius: 150 };
    run(game, Colossus.ATTACKS.web.telegraph + 0.05);
    assert.equal(game.webs.length, 1);
    assert.equal(Colossus.slowAt(game, state.player.x, state.player.y), Colossus.ATTACKS.web.slow);
    assert.equal(Colossus.slowAt(game, state.player.x + 500, state.player.y), 1);
    game.webs[0].life = 0.01;
    run(game, 0.05);
    assert.equal(game.webs.length, 0);
  });

  test('pris dans une toile, on avance bien moins vite', () => {
    const free = Sim.create(State.create(1));
    const stuck = Sim.create(State.create(1));
    stuck.webs.push({ x: 0, y: 0, radius: 5000, life: 99, max: 99 });
    const input = Sim.emptyInput();
    input.move.x = 1;
    for (let i = 0; i < 120; i++) {
      Sim.step(free, dt, input);
      Sim.step(stuck, dt, input);
    }
    assert.ok(stuck.state.player.x < free.state.player.x * 0.5);
  });

  test('le Léviathan est une chaîne de vertèbres qui suit la tête', () => {
    const { game, c } = near('leviathan', 1050, ['veilleur', 'tisseuse']);
    run(game, 6);
    const spacing = c.body.spacing * c.def.size;
    for (let k = 1; k < c.segments.length; k++) {
      const d = Math.hypot(c.segments[k].x - c.segments[k - 1].x, c.segments[k].y - c.segments[k - 1].y);
      assert.ok(d <= spacing + 1e-6, `vertèbre ${k} trop loin : ${d}`);
    }
    assert.deepEqual(Colossus.pointOf(c, 'seg:9'), c.segments[9]);
    assert.equal(c.mode, 'hunt');
  });

  test('la charge, annoncée, frappe ce qui reste sur sa ligne', () => {
    const { state, game, c } = near('leviathan', 500, ['veilleur', 'tisseuse']);
    run(game, 0.1);
    c.attackCd = 99;
    game.vitality.invulnerable = 0;
    const origin = { x: c.x, y: c.y };
    const dir = Math.atan2(state.player.y - c.y, state.player.x - c.x);
    c.attack = { kind: 'charge', t: 0, phase: 'telegraph', origin, dir, length: 900, width: 55, travelled: 0, hit: false };
    const hp = game.vitality.hp;
    const spot = { x: state.player.x, y: state.player.y };
    for (let i = 0; i < Math.round(3 / dt); i++) {
      state.player.x = spot.x;
      state.player.y = spot.y;
      Sim.step(game, dt, Sim.emptyInput());
    }
    assert.ok(game.vitality.hp <= hp - Colossus.ATTACKS.charge.damage + 1e-9, 'touché par la charge');
    assert.ok(Math.hypot(c.x - origin.x, c.y - origin.y) > 600, 'il a foncé');
  });

  test('les bienfaits de la Tisseuse et du Léviathan', () => {
    const state = State.create(1);
    const before = Stats.compute(state);
    state.colossi.tisseuse = 'tamed';
    state.colossi.leviathan = 'tamed';
    const after = Stats.compute(state);
    assert.equal(after.beingCap, before.beingCap + 10);
    assert.near(after.beingSpeed, before.beingSpeed * 1.3, 1e-9);
    assert.near(after.echoGain, before.echoGain * 2, 1e-9);
    assert.equal(after.offlineCap, before.offlineCap + 12 * 3600);
  });

  test('une sauvegarde de la 0.6 (format 6) se charge, colosses inconnus', () => {
    const result = Save.deserialize(JSON.stringify({ format: 6, state: { light: 1 } }));
    assert.ok(result.ok);
    assert.deepEqual(result.state.colossi, {});
  });

  test('l’état des colosses est relu et nettoyé', () => {
    assert.deepEqual(Save.sanitize({ colossi: { veilleur: 'tamed', inconnu: 'tamed' } }).colossi, { veilleur: 'tamed' });
    assert.deepEqual(Save.sanitize({ colossi: { veilleur: 'mort' } }).colossi, {});
  });
})();
