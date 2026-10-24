// Les colosses venus avec la 1.8 : leurs corps, leurs attaques et ce qui les rend singuliers. Chacun s'accroche
// à la mécanique commune de colossus.js par Vide.Beasts[kind] (voir l'en-tête de colossus.js).
//   bird     L'Oiseau d'aube : il vole, hors d'atteinte du corps à corps et de la pulsation. Il ne se pose que
//            rarement ; une chaîne le tire au sol, et sa jauge pleine (traits, harpons, balistes) l'y cloue.
//   medusa   La Méduse : une cloche qui pulse. Elle avance par à-coups, à chaque contraction ; ses sceaux ne
//            s'ouvrent qu'au sommet de chaque pulsation (et quand elle plie).
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

  Vide.Beasts = Object.assign(Vide.Beasts || {}, { bird, medusa });
})(globalThis.Vide);
