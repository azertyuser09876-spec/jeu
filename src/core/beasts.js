// Les colosses venus avec la 1.8 : leurs corps, leurs attaques et ce qui les rend singuliers. Chacun s'accroche
// à la mécanique commune de colossus.js par Vide.Beasts[kind] (voir l'en-tête de colossus.js).
//   bird     L'Oiseau d'aube : il vole, hors d'atteinte du corps à corps et de la pulsation. Il ne se pose que
//            rarement ; une chaîne le tire au sol, et sa jauge pleine (traits, harpons, balistes) l'y cloue.
//   medusa   La Méduse : une cloche qui pulse. Elle avance par à-coups, à chaque contraction ; ses sceaux ne
//            s'ouvrent qu'au sommet de chaque pulsation (et quand elle plie).
//   swarm    La Nuée : des centaines de fragments autour de quatre noyaux (ses sceaux). Tant que les fragments
//            entourent le noyau actif, il est à l'abri ; l'onde de pulsation les détruit, l'armée les dévore,
//            et ils renaissent des noyaux. Les toucher brûle la lumière.
//   sleeper  Le Dormeur : immense, il ne bouge ni ne combat. Ses sceaux sont des rêves, sur son dos : on ne les
//            atteint que debout sur lui. Chaque rêve apaisé lâche ses cauchemars (des ombres). Éveillé, il reste
//            où il est, et l'on peut bâtir sur son dos.
(function (Vide) {
  'use strict';
  const { util, Colony } = Vide;
  const C = Vide.Colossus;

  // --- Corps ---

  Object.assign(C.BODIES, {
    bird: {
      kind: 'bird',
      turn: 1.4,
      points: { head: [150, 0], back: [0, 0], wingL: [-10, -170], wingR: [-10, 170], tail: [-150, 0] },
      eyes: [[158, -8], [158, 8]],
      radius: 120,
      extent: 330,
      wingspan: 260,   // demi-envergure dessinée
    },
    medusa: {
      kind: 'medusa',
      turn: 0.9,
      points: { crown: [0, 0], rimL: [20, -95], rimR: [20, 95], tendril: [-230, 0] },
      eyes: [],
      radius: 130,
      extent: 300,
      bell: 120,        // rayon de la cloche (taille de référence)
      tentacles: 7,     // nombre de tentacules…
      links: 10,        // …de maillons chacun…
      spacing: 26,      // …espacés de tant
    },
    swarm: {
      kind: 'swarm',
      turn: 1,
      points: {},
      eyes: [],
      radius: 200,
      extent: 300,
      nuclei: 4,
      orbit: 90,        // rayon où tournent les noyaux (taille de référence)
      cloud: 260,       // rayon du nuage de fragments
    },
    sleeper: {
      kind: 'sleeper',
      turn: 0.1,
      points: { dream0: [70, -55], dream1: [-30, 65], dream2: [-110, -25] },
      eyes: [[285, -26], [285, 26]],
      radius: 260,
      extent: 330,
      shell: 200,       // rayon de son dos (on s'y tient pour atteindre ses rêves ; on y bâtit)
    },
  });

  // --- Attaques ---

  // Ce qu'une attaque d'oiseau frappe : la lumière (une fois) et les êtres actifs.
  function smite(game, c, hits, damage, beings) {
    const { player } = game.state;
    let struck = false;
    if (hits(player.x, player.y)) {
      Vide.Combat.hurtPlayer(game, damage, c.x, c.y);
      struck = true;
    }
    for (const b of game.colony.beings) if (Colony.isActive(b) && hits(b.x, b.y)) Vide.Combat.hurtBeing(game, b, beings);
    return struck;
  }

  // Distance de (x, y) au segment [a, b].
  function toSegment(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
  }

  Object.assign(C.ATTACKS, {
    // Fouet : trois tentacules lancés en éventail, le long de lignes annoncées.
    lash: {
      name: 'Fouet', telegraph: 1.1, active: 0.35, length: 700, width: 34, spread: 0.38, damage: 40, beings: 30,
      start: (game, c, o) => {
        const { player } = game.state;
        const a = C.ATTACKS.lash;
        const dir = Math.atan2(player.y - c.y, player.x - c.x);
        const lines = [-1, 0, 1].map((k) => {
          const ang = dir + k * a.spread + (c.rng() - 0.5) * 0.12;
          return { a: { x: c.x, y: c.y }, b: { x: c.x + Math.cos(ang) * a.length * o.k, y: c.y + Math.sin(ang) * a.length * o.k } };
        });
        return { kind: 'lash', t: 0, phase: 'telegraph', lines };
      },
      strike: (game, c) => {
        const a = C.ATTACKS.lash;
        const lines = c.attack.lines;
        smite(game, c, (x, y) => lines.some((l) => toSegment(x, y, l.a, l.b) <= a.width), a.damage, a.beings);
      },
    },
    // Piqué : il plonge le long d'une ligne annoncée, passe au ras du sol (à portée, le temps du passage).
    dive: {
      name: 'Piqué', telegraph: 1.3, active: 1.2, length: 900, width: 70, speed: 900, damage: 50, beings: 35,
      start: (game, c, o) => {
        const { player } = game.state;
        const dir = Math.atan2(player.y - c.y, player.x - c.x);
        return { kind: 'dive', t: 0, phase: 'telegraph', origin: { x: c.x, y: c.y }, dir, length: 900 * o.k, travelled: 0, hit: false };
      },
      step: (game, c, dt) => {
        const atk = c.attack;
        const a = C.ATTACKS.dive;
        c.diving = true;
        c.vx = Math.cos(atk.dir) * a.speed;
        c.vy = Math.sin(atk.dir) * a.speed;
        atk.travelled += a.speed * dt;
        const reach = a.width * c.def.size;
        const { player } = game.state;
        if (!atk.hit && Math.hypot(player.x - c.x, player.y - c.y) <= reach) {
          atk.hit = true;
          Vide.Combat.hurtPlayer(game, a.damage, c.x, c.y);
        }
        for (const b of game.colony.beings) {
          if (Colony.isActive(b) && Math.hypot(b.x - c.x, b.y - c.y) <= reach) Vide.Combat.hurtBeing(game, b, a.beings * dt * 3);
        }
        if (atk.travelled >= atk.length) {
          c.diving = false;
          C.endAttack(c);
        }
      },
    },
    // Rafale : un battement d'ailes qui repousse loin tout ce qui est devant lui.
    gale: {
      name: 'Rafale', telegraph: 1.2, active: 0.4, length: 700, spread: 0.5, damage: 20, beings: 15, push: 900,
      start: (game, c, o) => {
        const { player } = game.state;
        const dir = Math.atan2(player.y - c.y, player.x - c.x);
        return { kind: 'gale', t: 0, phase: 'telegraph', origin: { x: c.x, y: c.y }, dir, length: 700 * o.k, spread: 0.5 };
      },
      strike: (game, c) => {
        const atk = c.attack;
        const a = C.ATTACKS.gale;
        const hits = (x, y) => C.inCone(atk, x, y);
        if (smite(game, c, hits, a.damage, a.beings)) {
          game.velocity.x += Math.cos(atk.dir) * a.push;
          game.velocity.y += Math.sin(atk.dir) * a.push;
        }
        Vide.Sim.emit(game, 'gale', { x: atk.origin.x, y: atk.origin.y, dir: atk.dir });
      },
    },
    // Pluie de plumes : des pointes qui tombent tout autour de la lumière.
    feathers: {
      name: 'Pluie de plumes', telegraph: 1.2, radius: 70, count: 6, spread: 260, damage: 30, beings: 25,
      start: (game, c) => {
        const { player } = game.state;
        const a = C.ATTACKS.feathers;
        const points = [{ x: player.x, y: player.y }];
        for (let k = 1; k < a.count; k++) {
          const ang = c.rng() * Math.PI * 2;
          const d = a.spread * Math.sqrt(c.rng());
          points.push({ x: player.x + Math.cos(ang) * d, y: player.y + Math.sin(ang) * d });
        }
        return { kind: 'feathers', t: 0, phase: 'telegraph', points, radius: a.radius };
      },
      strike: (game, c) => {
        const atk = c.attack;
        const a = C.ATTACKS.feathers;
        smite(game, c, (x, y) => atk.points.some((p) => Math.hypot(x - p.x, y - p.y) <= atk.radius), a.damage, a.beings);
        Vide.Sim.emit(game, 'quake', { points: atk.points, radius: atk.radius, local: true });
      },
    },
  });

  // --- L'Oiseau d'aube ---

  const BIRD = {
    circle: 520,     // rayon de son vol autour de la lumière (taille de référence)
    landEvery: 20,   // il se pose de lui-même, de temps en temps…
    landFor: 4,      // …quelques secondes seulement
  };

  const bird = {
    init(game, c) {
      c.air = 1;            // altitude : 1 en vol, 0 au sol
      c.resting = 0;        // posé de lui-même (secondes restantes)
      c.landClock = BIRD.landEvery * (0.6 + c.rng() * 0.6);
      c.circle = c.rng() * Math.PI * 2;
      c.diving = false;
    },

    // Au sol (posé, cloué, retenu) ou au ras du sol (piqué), il est à portée ; sinon, hors d'atteinte.
    aloft: (c) => c.air > 0.5,
    guard: (game, c) => (c.air > 0.5 ? 'aloft' : null),

    // En chasse : il tourne autour de la lumière, et se pose parfois.
    hunt(game, c, dt, dist, held) {
      const { player } = game.state;
      if (c.resting > 0) {
        c.resting -= dt;
        C.stop(c, dt);
        if (c.resting <= 0) Vide.Sim.emit(game, 'takeoff', { id: c.id });
        return false;
      }
      c.landClock -= dt;
      if (c.landClock <= 0 && !c.attack) {
        c.landClock = BIRD.landEvery * (0.8 + c.rng() * 0.5);
        c.resting = BIRD.landFor;
        Vide.Sim.emit(game, 'landed', { id: c.id });
      }
      if (c.attack && c.attack.kind === 'dive' && c.attack.phase === 'active') return true;
      const r = BIRD.circle * C.reach(c);
      c.circle += (0.45 + 0.1 * C.phase(c)) * dt;
      const tx = player.x + Math.cos(c.circle) * r, ty = player.y + Math.sin(c.circle) * r;
      C.walkTo(c, tx, ty, c.def.speed * (1 + C.PHASE.speed * C.phase(c)) * held, dt);
      if (Math.hypot(c.vx, c.vy) > 5) C.turnTowards(c, Math.atan2(c.vy, c.vx), dt);
      return true;
    },

    update(game, c, dt) {
      const down = c.mode === 'kneel' || c.resting > 0 || c.bound || c.mode === 'calm';
      const target = down ? 0 : c.diving ? 0.3 : 1;
      c.air += (target - c.air) * util.damp(c.diving ? 6 : 2, dt);
      if (c.mode !== 'hunt') c.diving = false;
    },
  };

  // --- La Nuée ---

  const SWARM = {
    shards: 320,      // fragments au plus
    regen: 10,        // fragments renaissant par seconde (plus à chaque phase)
    shield: 120,      // un noyau est à l'abri s'il a autour de lui (dans ce rayon)…
    guard: 18,        // …au moins tant de fragments
    sting: 6,         // vitalité perdue par seconde et par fragment au contact de la lumière…
    stingMax: 10,     // …comptés jusqu'à dix (sinon, un assaut serait fatal d'un coup)
    contact: 40,
    eat: 6,           // dégâts d'armée pour détruire un fragment
  };

  function shardAt(c, k) {
    const s = c.def.size;
    const a = c.rng() * Math.PI * 2;
    const r = c.body.cloud * s * Math.sqrt(c.rng());
    return {
      x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: 0, vy: 0,
      a, r, spin: (0.25 + 0.5 * c.rng()) * (k % 2 ? 1 : -1),
    };
  }

  // Détruit les fragments pour lesquels `test` est vrai ; au plus `max`. Renvoie le nombre détruit.
  function shatter(c, test, max) {
    let n = 0;
    for (let i = c.shards.length - 1; i >= 0 && n < (max === undefined ? Infinity : max); i--) {
      if (!test(c.shards[i])) continue;
      c.shards.splice(i, 1);
      n++;
    }
    return n;
  }

  Object.assign(C.ATTACKS, {
    // Assaut : tous ses fragments fondent sur l'endroit marqué (là où était la lumière), puis reviennent.
    rush: {
      name: 'Assaut', telegraph: 1.1, active: 2.4,
      start: (game) => ({ kind: 'rush', t: 0, phase: 'telegraph', at: { x: game.state.player.x, y: game.state.player.y } }),
    },
    // Tourbillon : les fragments forment un anneau autour de la lumière, qui se resserre. Sors-en à temps.
    vortex: {
      name: 'Tourbillon', telegraph: 0.6, active: 2.4, from: 320, to: 40,
      start: (game) => ({ kind: 'vortex', t: 0, phase: 'telegraph', at: { x: game.state.player.x, y: game.state.player.y } }),
    },
  });

  const swarm = {
    init(game, c) {
      c.shards = [];
      for (let k = 0; k < SWARM.shards; k++) c.shards.push(shardAt(c, k));
      c.nuclei = [];
      for (let k = 0; k < c.body.nuclei; k++) c.nuclei.push({ x: c.x, y: c.y });
      c.regen = 0;
    },

    // Fragments autour du noyau actif.
    cover(c) {
      const n = c.nuclei[c.active];
      if (!n) return 0;
      const r2 = (SWARM.shield * c.def.size / 1.3) ** 2;
      let count = 0;
      for (const s of c.shards) if ((s.x - n.x) ** 2 + (s.y - n.y) ** 2 <= r2) count++;
      return count;
    },
    guard: (game, c) => (c.mode !== 'kneel' && swarm.cover(c) >= SWARM.guard ? 'shielded' : null),

    // L'onde de pulsation détruit les fragments qu'elle atteint.
    wave(game, c, x, y, radius) {
      const r2 = radius * radius;
      const n = shatter(c, (s) => (s.x - x) ** 2 + (s.y - y) ** 2 <= r2);
      if (n) Vide.Sim.emit(game, 'shards', { id: c.id, count: n });
    },

    // L'armée dévore les fragments (ceux du centre d'abord) en même temps qu'elle remplit sa jauge.
    struck(game, c, amount) {
      c.eaten = (c.eaten || 0) + amount / SWARM.eat;
      const n = Math.floor(c.eaten);
      if (n < 1) return;
      c.eaten -= n;
      const r = (c.body.cloud * c.def.size) * 0.5;
      shatter(c, (s) => Math.hypot(s.x - c.x, s.y - c.y) <= r, n) || shatter(c, () => true, n);
    },

    update(game, c, dt) {
      const s = c.def.size;
      const B = c.body;
      // Les noyaux tournent lentement autour du centre.
      c.nuclei.forEach((n, k) => {
        const a = c.time * 0.35 + (k / B.nuclei) * Math.PI * 2;
        const r = B.orbit * s * (k === 0 ? 0.4 : 1);
        n.x = c.x + Math.cos(a) * r;
        n.y = c.y + Math.sin(a) * r;
      });
      // Les fragments renaissent des noyaux.
      if (c.mode !== 'calm') {
        c.regen += SWARM.regen * (1 + 0.3 * C.phase(c)) * dt;
        while (c.regen >= 1 && c.shards.length < SWARM.shards) {
          c.regen -= 1;
          const shard = shardAt(c, c.shards.length);
          const n = c.nuclei[Math.floor(c.rng() * c.nuclei.length)];
          shard.x = n.x;
          shard.y = n.y;
          c.shards.push(shard);
        }
        if (c.shards.length >= SWARM.shards) c.regen = 0;
      }
      // Chaque fragment vise sa place dans le nuage — ou la lumière, pendant un assaut ou un tourbillon. À genou,
      // la nuée se disperse au loin.
      const { player } = game.state;
      const atk = c.attack && c.attack.phase === 'active' ? c.attack : null;
      // (Apaisée, sa nuée se resserre autour de la lumière, sans l'étouffer.)
      const tame = c.mode === 'calm' || c.mode === 'home' || c.mode === 'resident';
      const scatter = c.mode === 'kneel' ? 2.2 : tame ? 0.6 : 1;
      const k = util.damp(c.mode === 'kneel' ? 1 : 3, dt);
      for (const f of c.shards) {
        f.a += f.spin * dt;
        let tx, ty;
        if (atk && atk.kind === 'rush') {
          tx = atk.at.x + Math.cos(f.a) * f.r * 0.3;
          ty = atk.at.y + Math.sin(f.a) * f.r * 0.3;
        } else if (atk && atk.kind === 'vortex') {
          const V = C.ATTACKS.vortex;
          const ring = V.from + (V.to - V.from) * Math.min(1, atk.t / V.active);
          tx = atk.at.x + Math.cos(f.a * 3) * ring;
          ty = atk.at.y + Math.sin(f.a * 3) * ring;
        } else {
          tx = c.x + Math.cos(f.a) * f.r * scatter;
          ty = c.y + Math.sin(f.a) * f.r * scatter;
        }
        f.vx += ((tx - f.x) * 3 - f.vx) * k;
        f.vy += ((ty - f.y) * 3 - f.vy) * k;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      // Leur contact brûle la lumière (sauf apaisée).
      if (c.mode === 'calm' || c.mode === 'home' || c.mode === 'resident') return;
      const r2 = SWARM.contact * SWARM.contact;
      let touching = 0;
      for (const f of c.shards) if ((f.x - player.x) ** 2 + (f.y - player.y) ** 2 <= r2) touching++;
      const v = game.vitality;
      if (touching && v.invulnerable <= 0) {
        v.hp -= Math.min(touching, SWARM.stingMax) * SWARM.sting * dt;
        v.lastHurt = game.time;
        v.hurt = Math.max(v.hurt || 0, 0.4);
        if (v.hp <= 0) Vide.Combat.disperse(game);
      }
    },
  };

  // --- Le Dormeur ---

  const SLEEPER = {
    nightmares: 10,   // ombres lâchées par le premier rêve apaisé…
    worse: 8,         // …et en plus à chaque rêve suivant
  };

  // Rayon de son dos, dans le monde.
  const backOf = (d) => C.BODIES.sleeper.shell * d.size;

  // (x, y) est-il sur le dos du Dormeur ? (Il ne bouge jamais : son repaire suffit.)
  function onBack(state, x, y) {
    const d = C.def('dormeur');
    const at = C.lair(state, d);
    return Math.hypot(x - at.x, y - at.y) <= backOf(d);
  }

  const sleeper = {
    init(game, c) {
      if (c.mode === 'roam') c.mode = 'sleep';
      c.breath = 0;
    },

    // Dans son sommeil, il respire. On le découvre en approchant.
    rest(game, c, dt, dist) {
      C.stop(c, dt);
      if (dist < c.def.awareness && C.status(game.state, c.id) === 'heard') {
        game.state.colossi[c.id] = 'found';
        Vide.Sim.emit(game, 'colossusFound', { id: c.id, veiled: C.veiled(game.state, c, 0), sleeper: true });
      }
    },

    // Ses rêves ne s'atteignent que debout sur son dos.
    guard: (game, c) => (onBack(game.state, game.state.player.x, game.state.player.y) ? null : 'asleep'),

    // Un rêve apaisé lâche ses cauchemars autour de lui.
    phase(game, c) {
      const n = SLEEPER.nightmares + SLEEPER.worse * (C.phase(c) - 1);
      const kinds = ['errante', 'rodeuse', 'massive'];
      const R = backOf(c.def) * 1.1;
      for (let k = 0; k < n; k++) {
        const a = c.rng() * Math.PI * 2;
        const s = Vide.Shadows.spawn(game, kinds[k % 3 === 2 && C.phase(c) > 1 ? 2 : k % 2], c.x + Math.cos(a) * R, c.y + Math.sin(a) * R, 'roam');
        s.nightmare = true;
      }
      Vide.Sim.emit(game, 'nightmare', { id: c.id, count: n, left: c.seals.length - c.active });
    },

    update(game, c, dt) {
      c.breath += dt / 7; // un souffle très lent
    },
  };

  // --- La Méduse ---

  const MEDUSA = {
    period: 4.5,   // secondes entre deux pulsations (plus court à chaque phase)
    open: 0.7,     // sa cloche est ouverte (sceaux à portée) de 70 % à 100 % de chaque pulsation
    thrust: 2.4,   // élan de chaque contraction, en fois sa vitesse
  };

  const medusa = {
    init(game, c) {
      c.beat = c.rng();
      c.pulsed = false;
      c.tentacles = [];
      const B = c.body;
      for (let t = 0; t < B.tentacles; t++) {
        const chain = [];
        for (let k = 0; k < B.links; k++) chain.push({ x: c.x - k * B.spacing * c.def.size, y: c.y });
        c.tentacles.push(chain);
      }
    },

    period: (c) => MEDUSA.period / (1 + C.PHASE.speed * C.phase(c)),
    isOpen: (c) => c.mode === 'kneel' || c.beat >= MEDUSA.open,
    guard: (game, c) => (medusa.isOpen(c) ? null : 'closed'),

    // En chasse : à chaque contraction, un élan vers la lumière (sans la coller) ; entre deux, elle dérive.
    hunt(game, c, dt, dist, held) {
      const { player } = game.state;
      const toward = Math.atan2(player.y - c.y, player.x - c.x);
      if (c.pulsed && dist > 360 * C.reach(c)) {
        const s = c.def.speed * MEDUSA.thrust * held * (1 + C.PHASE.speed * C.phase(c));
        c.vx += Math.cos(toward) * s;
        c.vy += Math.sin(toward) * s;
      }
      const k = util.damp(0.9, dt);
      c.vx -= c.vx * k;
      c.vy -= c.vy * k;
      C.turnTowards(c, toward, dt);
      return true;
    },

    update(game, c, dt) {
      c.pulsed = false;
      c.beat += dt / medusa.period(c);
      if (c.beat >= 1) {
        c.beat -= 1;
        c.pulsed = true;
        Vide.Sim.emit(game, 'medusaPulse', { id: c.id, x: c.x, y: c.y });
      }
      // Les tentacules traînent derrière la cloche, et ondulent.
      const B = c.body;
      const s = c.def.size;
      c.tentacles.forEach((chain, t) => {
        const off = (t / (B.tentacles - 1) - 0.5) * 2 * B.bell * 0.8;
        chain[0] = C.toWorld(c, -B.bell * 0.6, off);
        for (let k = 1; k < chain.length; k++) {
          const sway = Math.sin(c.time * 2 + t * 1.3 + k * 0.5) * 6 * s;
          const back = C.toWorld(c, -B.bell * 0.6 - k * B.spacing, off + sway);
          const prev = chain[k - 1];
          let x = chain[k].x + (back.x - chain[k].x) * util.damp(4, dt);
          let y = chain[k].y + (back.y - chain[k].y) * util.damp(4, dt);
          const dx = x - prev.x, dy = y - prev.y;
          const d = Math.hypot(dx, dy) || 1;
          const max = B.spacing * s;
          if (d > max) {
            x = prev.x + (dx / d) * max;
            y = prev.y + (dy / d) * max;
          }
          chain[k] = { x, y };
        }
      });
    },
  };

  Vide.Beasts = Object.assign(Vide.Beasts || {}, { bird, medusa, swarm, sleeper, SWARM, SLEEPER, onBack, backOf });
})(globalThis.Vide);
