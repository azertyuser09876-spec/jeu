// Les colosses venus avec la 1.8 : leurs corps, leurs attaques et ce qui les rend singuliers. Chacun s'accroche
// à la mécanique commune de colossus.js par Vide.Beasts[kind] (voir l'en-tête de colossus.js).
//   bird   L'Oiseau d'aube : il vole, hors d'atteinte du corps à corps et de la pulsation. Il ne se pose que
//          rarement ; une chaîne le tire au sol, et sa jauge pleine (traits, harpons, balistes) l'y cloue.
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

  Object.assign(C.ATTACKS, {
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

  Vide.Beasts = Object.assign(Vide.Beasts || {}, { bird });
})(globalThis.Vide);
