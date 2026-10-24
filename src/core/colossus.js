// Les colosses vivants : marche procédurale, chasse, attaques annoncées, sceaux, apaisement.
// État persistant : state.colossi[id] = 'heard' (battement entendu) | 'found' (rencontré) | 'tamed' (apaisé).
// Tout le reste (position, sceaux entamés, toiles…) est recréé au chargement : un combat abandonné repart de zéro.
(function (Vide) {
  'use strict';
  const { util, Territory, Colony } = Vide;

  // Corps : coordonnées locales (le colosse regarde vers +x), multipliées par la taille du colosse.
  //   kind 'legged' : corps rigide porté par des pattes (marche procédurale) ;
  //   kind 'serpent' : chaîne de vertèbres qui suivent la tête.
  const BODIES = {
    quadruped: {
      kind: 'legged',
      spine: [[160, 0], [115, 0], [65, 0], [10, 0], [-45, 0], [-100, 0]],
      tail: { length: 150, segments: 7 },
      legs: [
        { hip: [65, -40], rest: [100, -105], side: -1 },
        { hip: [65, 40], rest: [100, 105], side: 1 },
        { hip: [-45, -40], rest: [-15, -105], side: -1 },
        { hip: [-45, 40], rest: [-15, 105], side: 1 },
      ],
      // Les pattes avancent par groupes (ici en diagonale), jamais deux groupes à la fois.
      pairs: [[0, 3], [1, 2]],
      thigh: 80,
      shin: 80,
      stride: 75,
      stepTime: 0.6,
      turn: 0.6,      // vitesse de rotation (rad/s) : une masse énorme tourne lentement
      points: { head: [160, 0], back: [10, 0], tail: 'tail' },
      eyes: [[170, -14], [170, 14]],
      radius: 110,
      // Silhouette (demi-contour, de la tête à l'arrière ; symétrisée au dessin).
      outline: [[185, 0], [168, 18], [140, 24], [112, 22], [80, 50], [30, 64], [-20, 60], [-60, 50], [-95, 26], [-112, 0]],
    },
    arachnid: {
      kind: 'legged',
      spine: [[120, 0], [70, 0], [20, 0], [-40, 0], [-110, 0], [-170, 0]],
      tail: null,
      legs: [
        { hip: [60, -28], rest: [200, -150], side: -1 },
        { hip: [60, 28], rest: [200, 150], side: 1 },
        { hip: [35, -34], rest: [80, -210], side: -1 },
        { hip: [35, 34], rest: [80, 210], side: 1 },
        { hip: [10, -34], rest: [-40, -205], side: -1 },
        { hip: [10, 34], rest: [-40, 205], side: 1 },
        { hip: [-15, -28], rest: [-140, -170], side: -1 },
        { hip: [-15, 28], rest: [-140, 170], side: 1 },
      ],
      // Marche des araignées : deux « tétrapodes » alternés (G1, D2, G3, D4) puis (D1, G2, D3, G4).
      pairs: [[0, 3, 4, 7], [1, 2, 5, 6]],
      thigh: 120,
      shin: 120,
      stride: 70,
      stepTime: 0.45,
      turn: 0.45,
      points: { head: [120, 0], back: [20, 0], abdomen: [-110, 0], spinneret: [-175, 0] },
      eyes: [[128, -8], [128, 8], [118, -15], [118, 15]],
      radius: 120,
      outline: [[135, 0], [120, 20], [90, 30], [50, 36], [20, 30], [0, 26], [-30, 52], [-80, 70], [-130, 64], [-170, 40], [-190, 0]],
    },
    serpent: {
      kind: 'serpent',
      segments: 30,
      spacing: 26,
      turn: 1.6,
      eyes: [[22, -11], [22, 11]],
      radius: 90,
    },
  };

  // Attaques : toujours annoncées (télégraphiées) avant de frapper.
  const ATTACKS = {
    stomp: { name: 'Piétinement', telegraph: 1.4, radius: 75, damage: 30, beings: 25 },
    breath: { name: 'Souffle', telegraph: 1.6, active: 0.5, length: 650, spread: 0.3, damage: 45, beings: 30 },
    web: { name: 'Toile', telegraph: 1.2, radius: 150, duration: 7, slow: 0.35 },
    charge: { name: 'Charge', telegraph: 1.5, length: 900, width: 55, speed: 700, damage: 50, beings: 35 },
  };

  const FOOT = { damage: 15, radius: 30, shadowRadius: 80, shadowDamage: 60 };
  const MAX_STEP = 1.5; // longueur maximale d'un pas, en foulées

  function def(id) {
    const d = Vide.COLOSSI.find((c) => c.id === id);
    if (!d) throw new Error(`Colosse inconnu : ${id}`);
    return d;
  }

  function status(state, id) {
    return state.colossi[id] || 'unknown';
  }

  // Repaire : une direction propre à la partie, à la distance prévue.
  function lair(state, d) {
    const angle = util.hash2(d.lair.angleSeed, 7, state.seed) * Math.PI * 2;
    return { x: Math.cos(angle) * d.lair.distance, y: Math.sin(angle) * d.lair.distance };
  }

  // Point de ronde d'un colosse apaisé : juste au-delà du bord du plus grand village (ou autour de l'origine).
  function residentSpot(state, angle) {
    const home = Vide.Villages.main(state);
    const r = Territory.radius(home) + 90;
    const cx = home ? home.x : 0, cy = home ? home.y : 0;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  // --- Géométrie ---

  function toWorld(c, lx, ly) {
    const s = c.def.size;
    const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
    return { x: c.x + (lx * cos - ly * sin) * s, y: c.y + (lx * sin + ly * cos) * s };
  }

  // Queue (corps à pattes) : une chaîne qui ondule doucement derrière les hanches.
  function tailPoints(c) {
    const { tail, spine } = c.body;
    if (!tail) return [];
    const base = spine[spine.length - 1];
    const pts = [];
    for (let k = 1; k <= tail.segments; k++) {
      const lx = base[0] - k * (tail.length / tail.segments);
      const ly = Math.sin(c.time * 1.2 + k * 0.6) * k * 4;
      pts.push(toWorld(c, lx, ly));
    }
    return pts;
  }

  // Point nommé du corps : 'head', 'back'… ; 'tail' (queue) ; 'seg:K' (vertèbre K d'un serpent).
  function pointOf(c, at) {
    if (at.startsWith('seg:')) return c.segments[Number(at.slice(4))];
    if (c.body.kind === 'serpent') return c.segments[0];
    const p = c.body.points[at];
    if (p === 'tail') {
      const tail = tailPoints(c);
      return tail[Math.floor(tail.length * 0.6)];
    }
    return toWorld(c, p[0], p[1]);
  }

  function activeSeal(c) {
    return c.seals[c.active] || null;
  }

  function sealPos(c) {
    const seal = activeSeal(c);
    return seal ? pointOf(c, seal.at) : null;
  }

  // Genou calculé par cinématique inverse à deux segments (cuisse, tibia). Des deux solutions, on garde
  // toujours celle qui s'écarte du corps : le genou ne bascule jamais de l'autre côté de la patte.
  function knee(c, hip, foot) {
    const s = c.def.size;
    const a = c.body.thigh * s, b = c.body.shin * s;
    const dx = foot.x - hip.x, dy = foot.y - hip.y;
    const d = Math.min(Math.hypot(dx, dy), a + b - 1);
    const base = Math.atan2(dy, dx);
    const bend = Math.acos(util.clamp((a * a + d * d - b * b) / (2 * a * d || 1), -1, 1));
    let best = null;
    let bestD = -1;
    for (const angle of [base + bend, base - bend]) {
      const k = { x: hip.x + Math.cos(angle) * a, y: hip.y + Math.sin(angle) * a };
      const away = Math.hypot(k.x - c.x, k.y - c.y);
      if (away > bestD) {
        bestD = away;
        best = k;
      }
    }
    return best;
  }

  // --- Création ---

  function spawnEntity(game, d) {
    const { state } = game;
    const tamed = status(state, d.id) === 'tamed';
    const orbit = util.hash2(d.lair.angleSeed, 11, state.seed) * Math.PI * 2;
    const at = tamed ? residentSpot(state, orbit) : lair(state, d);
    const body = BODIES[d.body];
    const c = {
      id: d.id,
      def: d,
      body,
      x: at.x,
      y: at.y,
      angle: 0,
      vx: 0,
      vy: 0,
      time: 0,
      mode: tamed ? 'resident' : 'roam',
      seals: d.seals.map((s) => ({ at: s.at, hp: s.hp, max: s.hp })),
      active: tamed ? d.seals.length : 0,
      stagger: 0,
      kneel: 0,
      attack: null,
      attackCd: 3,
      wander: null,
      pause: 0,
      calm: tamed ? 1 : 0,   // 0 sauvage → 1 apaisé (teinte dorée)
      calmTimer: 0,
      orbit,
      lastWave: -1,
      hitFlash: 0,
      rng: util.rng(state.seed ^ Math.imul(d.lair.angleSeed + 3, 0x632be5ab)),
      core: { x: at.x, y: at.y, hp: 1, colossus: null, radius: body.radius * d.size },
    };
    c.core.colossus = c;
    if (body.kind === 'legged') {
      c.legs = body.legs.map((l) => {
        const foot = toWorld(c, l.rest[0], l.rest[1]);
        return { foot, from: foot, to: foot, t: -1, lift: 0, duration: body.stepTime };
      });
    } else {
      c.segments = [];
      for (let k = 0; k < body.segments; k++) c.segments.push({ x: at.x - k * body.spacing * d.size, y: at.y });
    }
    game.colossi.push(c);
    return c;
  }

  function sync(game) {
    for (const d of Vide.COLOSSI) {
      if (status(game.state, d.id) === 'unknown') continue;
      if (!game.colossi.some((c) => c.id === d.id)) spawnEntity(game, d);
    }
  }

  function create(game) {
    game.colossi = [];
    game.webs = [];
    sync(game);
  }

  // --- Déplacements ---

  function walkTo(c, tx, ty, speed, dt) {
    const dx = tx - c.x, dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    const s = d > 20 ? speed * Math.min(1, d / 120) : 0;
    const k = util.damp(1.5, dt);
    c.vx += ((d ? dx / d : 0) * s - c.vx) * k;
    c.vy += ((d ? dy / d : 0) * s - c.vy) * k;
    return d;
  }

  function stop(c, dt) {
    const k = util.damp(2, dt);
    c.vx -= c.vx * k;
    c.vy -= c.vy * k;
  }

  // Le colosse tourne lentement, comme une masse énorme.
  function turnTowards(c, angle, dt) {
    let diff = angle - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const max = c.body.turn * dt;
    c.angle += util.clamp(diff, -max, max);
  }

  function footfall(game, c, foot) {
    const { state } = game;
    Vide.Sim.emit(game, 'footfall', { x: foot.x, y: foot.y, id: c.id });
    if (c.mode === 'resident' || c.mode === 'home') {
      // Apaisé : ses pas écrasent les ombres qui rôdent près du territoire.
      for (const s of game.shadows.list) {
        if (Math.hypot(s.x - foot.x, s.y - foot.y) <= FOOT.shadowRadius) Vide.Shadows.damage(s, FOOT.shadowDamage);
      }
      return;
    }
    if (c.mode === 'calm') return;
    const r = FOOT.radius * c.def.size;
    if (Math.hypot(state.player.x - foot.x, state.player.y - foot.y) <= r) {
      Vide.Combat.hurtPlayer(game, FOOT.damage, foot.x, foot.y);
    }
    for (const b of game.colony.beings) {
      if (Colony.isActive(b) && Math.hypot(b.x - foot.x, b.y - foot.y) <= r) Vide.Combat.hurtBeing(game, b, FOOT.damage);
    }
  }

  function updateLegs(game, c, dt) {
    const s = c.def.size;
    const stride = c.body.stride * s;
    const ideal = c.body.legs.map((l) => {
      const p = toWorld(c, l.rest[0], l.rest[1]);
      return { x: p.x + c.vx * 0.35, y: p.y + c.vy * 0.35 };
    });
    const stepping = (group) => group.some((i) => c.legs[i].t >= 0);

    c.legs.forEach((leg) => {
      if (leg.t < 0) return;
      leg.t += dt / leg.duration;
      const p = Math.min(1, leg.t);
      const ease = p * p * (3 - 2 * p);
      leg.foot = { x: leg.from.x + (leg.to.x - leg.from.x) * ease, y: leg.from.y + (leg.to.y - leg.from.y) * ease };
      leg.lift = Math.sin(Math.PI * p);
      if (leg.t >= 1) {
        leg.t = -1;
        leg.lift = 0;
        leg.foot = leg.to;
        footfall(game, c, leg.foot);
      }
    });

    if (c.mode === 'kneel') return; // à genou, il ne bouge plus les pattes
    const groups = c.body.pairs;
    if (groups.some(stepping)) return;
    for (const group of groups) {
      const far = group.some((i) => Math.hypot(c.legs[i].foot.x - ideal[i].x, c.legs[i].foot.y - ideal[i].y) > stride);
      if (!far) continue;
      for (const i of group) {
        const leg = c.legs[i];
        const dx = ideal[i].x - leg.foot.x, dy = ideal[i].y - leg.foot.y;
        const d = Math.hypot(dx, dy);
        if (d < stride * 0.3) continue; // déjà bien placée : elle reste au sol
        // Un pas ne dépasse jamais 1,5 foulée, et dure d'autant plus qu'il est long : pas de patte qui fouette.
        const k = Math.min(1, (stride * MAX_STEP) / d);
        leg.from = leg.foot;
        leg.to = { x: leg.foot.x + dx * k, y: leg.foot.y + dy * k };
        leg.duration = c.body.stepTime * util.clamp((d * k) / stride, 0.75, 1.4);
        leg.t = 0;
      }
      break;
    }
  }

  // Serpent : la tête ondule en avançant, chaque vertèbre suit la précédente à distance fixe.
  function updateSegments(c) {
    const spacing = c.body.spacing * c.def.size;
    const seg = c.segments;
    seg[0] = { x: c.x, y: c.y };
    for (let k = 1; k < seg.length; k++) {
      const dx = seg[k].x - seg[k - 1].x, dy = seg[k].y - seg[k - 1].y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > spacing) seg[k] = { x: seg[k - 1].x + (dx / d) * spacing, y: seg[k - 1].y + (dy / d) * spacing };
    }
  }

  // --- Toiles (ralentissent tout ce qui s'y prend) ---

  function slowAt(game, x, y) {
    let factor = 1;
    for (const w of game.webs || []) {
      if (Math.hypot(x - w.x, y - w.y) <= w.radius) factor = Math.min(factor, ATTACKS.web.slow);
    }
    return factor;
  }

  // --- Attaques ---

  function startAttack(game, c) {
    const { player } = game.state;
    const kind = c.def.attacks[Math.floor(c.rng() * c.def.attacks.length)];
    const a = ATTACKS[kind];
    const head = pointOf(c, 'head');
    const dir = Math.atan2(player.y - head.y, player.x - head.x);
    if (kind === 'stomp') {
      const v = game.velocity;
      const angle = c.rng() * Math.PI * 2;
      const off = 90 + c.rng() * 60;
      c.attack = {
        kind, t: 0, phase: 'telegraph',
        points: [
          { x: player.x, y: player.y },
          { x: player.x + v.x * 0.9, y: player.y + v.y * 0.9 },
          { x: player.x + Math.cos(angle) * off, y: player.y + Math.sin(angle) * off },
        ],
        radius: a.radius,
      };
    } else if (kind === 'web') {
      c.attack = { kind, t: 0, phase: 'telegraph', at: { x: player.x, y: player.y }, radius: a.radius };
    } else if (kind === 'charge') {
      c.attack = { kind, t: 0, phase: 'telegraph', origin: head, dir, length: a.length, width: a.width, travelled: 0, hit: false };
    } else {
      c.attack = { kind, t: 0, phase: 'telegraph', origin: head, dir, length: a.length, spread: a.spread };
    }
    Vide.Sim.emit(game, 'colossusAttack', { id: c.id, kind });
  }

  function inCone(atk, x, y) {
    const dx = x - atk.origin.x, dy = y - atk.origin.y;
    if (Math.hypot(dx, dy) > atk.length) return false;
    let diff = Math.atan2(dy, dx) - atk.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) <= atk.spread;
  }

  // Ce que frappe une attaque au moment où elle tombe.
  function strike(game, c) {
    const atk = c.attack;
    const a = ATTACKS[atk.kind];
    const { player } = game.state;
    if (atk.kind === 'web') {
      game.webs.push({ x: atk.at.x, y: atk.at.y, radius: atk.radius, life: a.duration, max: a.duration });
      Vide.Sim.emit(game, 'web', { x: atk.at.x, y: atk.at.y });
      return;
    }
    if (atk.kind === 'charge') return; // la charge frappe pendant sa course (voir charging)
    const hits = (x, y) => (atk.kind === 'stomp'
      ? atk.points.some((p) => Math.hypot(x - p.x, y - p.y) <= atk.radius)
      : inCone(atk, x, y));
    if (hits(player.x, player.y)) Vide.Combat.hurtPlayer(game, a.damage, c.x, c.y);
    for (const b of game.colony.beings) {
      if (Colony.isActive(b) && hits(b.x, b.y)) Vide.Combat.hurtBeing(game, b, a.beings);
    }
    if (atk.kind === 'stomp') Vide.Sim.emit(game, 'quake', { points: atk.points, radius: atk.radius });
  }

  // Charge : le colosse fonce le long de la ligne annoncée et frappe ce qu'il traverse.
  function charging(game, c, dt) {
    const atk = c.attack;
    const a = ATTACKS.charge;
    const step = Math.min(a.speed * dt, atk.length - atk.travelled);
    c.vx = Math.cos(atk.dir) * a.speed;
    c.vy = Math.sin(atk.dir) * a.speed;
    c.x += Math.cos(atk.dir) * step;
    c.y += Math.sin(atk.dir) * step;
    atk.travelled += step;
    const { player } = game.state;
    const reach = atk.width * c.def.size;
    if (!atk.hit && Math.hypot(player.x - c.x, player.y - c.y) <= reach) {
      atk.hit = true;
      Vide.Combat.hurtPlayer(game, a.damage, c.x, c.y);
    }
    for (const b of game.colony.beings) {
      if (Colony.isActive(b) && Math.hypot(b.x - c.x, b.y - c.y) <= reach) Vide.Combat.hurtBeing(game, b, a.beings * dt * 4);
    }
    if (atk.travelled >= atk.length) {
      c.attack = null;
      c.attackCd = 3 + c.rng() * 2;
      c.vx *= 0.2;
      c.vy *= 0.2;
    }
  }

  function updateAttack(game, c, dt) {
    const atk = c.attack;
    const a = ATTACKS[atk.kind];
    atk.t += dt;
    if (atk.phase === 'telegraph' && atk.t >= a.telegraph) {
      strike(game, c);
      if (atk.kind === 'charge') {
        atk.phase = 'active';
        atk.t = 0;
      } else if (a.active) {
        atk.phase = 'active';
        atk.t = 0;
      } else {
        c.attack = null;
        c.attackCd = 3.5 + c.rng() * 2;
      }
    } else if (atk.phase === 'active' && atk.kind !== 'charge' && atk.t >= a.active) {
      c.attack = null;
      c.attackCd = 3.5 + c.rng() * 2;
    }
  }

  // --- Sceaux, mise à genou, apaisement ---

  function hostile(c) {
    return c.mode === 'roam' || c.mode === 'hunt' || c.mode === 'kneel';
  }

  function provoke(game, c) {
    if (c.mode !== 'roam') return;
    c.mode = 'hunt';
    if (status(game.state, c.id) === 'heard') {
      game.state.colossi[c.id] = 'found';
      Vide.Sim.emit(game, 'colossusFound', { id: c.id });
    }
  }

  // Dégâts de l'armée : ils remplissent la jauge qui le fait plier.
  function hit(game, c, amount) {
    if (!hostile(c)) return;
    provoke(game, c);
    c.hitFlash = Math.min(1, c.hitFlash + 0.3);
    if (c.mode === 'kneel') return;
    c.stagger += amount;
    if (c.stagger >= c.def.stagger) {
      c.stagger = 0;
      c.mode = 'kneel';
      c.kneel = c.def.kneel;
      c.attack = null;
      Vide.Sim.emit(game, 'kneel', { id: c.id });
    }
  }

  function tame(game, c) {
    game.state.colossi[c.id] = 'tamed';
    c.mode = 'calm';
    c.calmTimer = 6;
    c.attack = null;
    Vide.Sim.emit(game, 'colossusTamed', { id: c.id });
  }

  // Coup porté au sceau actif (par la pulsation) ; ×2 quand le colosse est à genou.
  function sealHit(game, c, amount) {
    const seal = activeSeal(c);
    if (!seal || !hostile(c)) return false;
    provoke(game, c);
    seal.hp -= amount * (c.mode === 'kneel' ? 2 : 1);
    c.hitFlash = 1;
    if (seal.hp > 0) return false;
    seal.hp = 0;
    seal.broken = true;
    c.active++;
    const left = c.seals.length - c.active;
    Vide.Sim.emit(game, 'sealBroken', { id: c.id, left });
    if (left === 0) tame(game, c);
    return true;
  }

  // L'onde de pulsation touche le sceau actif s'il est dans son rayon (une fois par onde).
  function pulseHit(game, x, y, radius) {
    for (const c of game.colossi) {
      if (!hostile(c) || c.lastWave === game.pulse.id) continue;
      const p = sealPos(c);
      if (p && Math.hypot(p.x - x, p.y - y) <= radius) {
        c.lastWave = game.pulse.id;
        sealHit(game, c, game.stats.pulseDamage);
      }
    }
  }

  // Colosse hostile que l'armée peut frapper dans une zone, sous forme de cible (c.core).
  function target(game, ax, ay, radius) {
    for (const c of game.colossi) {
      if ((c.mode === 'hunt' || c.mode === 'kneel') && Math.hypot(c.core.x - ax, c.core.y - ay) <= radius + c.core.radius) {
        return c.core;
      }
    }
    return null;
  }

  // --- Mise à jour ---

  function unlock(game) {
    const { state } = game;
    for (const d of Vide.COLOSSI) {
      if (status(state, d.id) !== 'unknown' || !d.requires(state)) continue;
      state.colossi[d.id] = 'heard';
      Vide.Sim.emit(game, 'heartbeat', { id: d.id });
    }
    sync(game);
  }

  function updateOne(game, c, dt) {
    const { state } = game;
    const d = c.def;
    const { player } = state;
    const dist = Math.hypot(player.x - c.x, player.y - c.y);
    c.time += dt;
    c.hitFlash = Math.max(0, c.hitFlash - dt * 2);
    c.attackCd -= dt;
    let moved = false; // la charge déplace le colosse elle-même

    switch (c.mode) {
      case 'roam': {
        // Flânerie autour du repaire ; les sceaux entamés se referment.
        for (const seal of c.seals) if (!seal.broken) seal.hp = Math.min(seal.max, seal.hp + 5 * dt);
        c.stagger = Math.max(0, c.stagger - 20 * dt);
        const home = lair(state, d);
        if (!c.wander || c.pause > 0) {
          c.pause -= dt;
          if (!c.wander || c.pause <= 0) {
            const a = c.rng() * Math.PI * 2;
            const r = d.roam * Math.sqrt(c.rng());
            c.wander = { x: home.x + Math.cos(a) * r, y: home.y + Math.sin(a) * r };
            c.pause = 0;
          }
          stop(c, dt);
        } else if (walkTo(c, c.wander.x, c.wander.y, d.speed * 0.6, dt) < 40) {
          c.wander = null;
          c.pause = 3 + c.rng() * 4;
        }
        if (dist < d.awareness && game.vitality.invulnerable <= 0) provoke(game, c);
        break;
      }
      case 'hunt': {
        if (dist > d.leash || (game.vitality.invulnerable > 0 && dist > d.awareness)) {
          c.mode = 'roam';
          c.attack = null;
          c.wander = null;
          Vide.Sim.emit(game, 'colossusLost', { id: c.id });
          break;
        }
        if (c.attack && c.attack.kind === 'charge' && c.attack.phase === 'active') {
          charging(game, c, dt);
          moved = true;
          break;
        }
        if (c.attack && c.attack.kind === 'charge') stop(c, dt); // il se ramasse avant de foncer
        else if (dist > 380) walkTo(c, player.x, player.y, d.speed, dt);
        else stop(c, dt);
        turnTowards(c, Math.atan2(player.y - c.y, player.x - c.x), dt);
        if (c.attack) updateAttack(game, c, dt);
        else if (c.attackCd <= 0 && dist < 800) startAttack(game, c);
        break;
      }
      case 'kneel':
        stop(c, dt);
        c.kneel -= dt;
        if (c.kneel <= 0) {
          c.mode = 'hunt';
          c.attackCd = 2;
          Vide.Sim.emit(game, 'rise', { id: c.id });
        }
        break;
      case 'calm':
        stop(c, dt);
        c.calm = Math.min(1, c.calm + dt / 4);
        c.calmTimer -= dt;
        if (c.calmTimer <= 0) c.mode = 'home';
        break;
      case 'home': {
        const spot = residentSpot(state, c.orbit);
        if (walkTo(c, spot.x, spot.y, 80, dt) < 80) c.mode = 'resident';
        break;
      }
      case 'resident': {
        // Ronde lente autour du territoire.
        const r = Territory.radius(Vide.Villages.main(state)) + 90;
        c.orbit += (16 / r) * dt;
        const spot = residentSpot(state, c.orbit);
        walkTo(c, spot.x, spot.y, 22, dt);
        break;
      }
    }

    if (c.mode !== 'hunt' && Math.hypot(c.vx, c.vy) > 3) turnTowards(c, Math.atan2(c.vy, c.vx), dt);
    if (!moved) {
      let vx = c.vx, vy = c.vy;
      if (c.body.kind === 'serpent') {
        // Ondulation : une poussée latérale qui fait serpenter tout le corps.
        const speed = Math.hypot(vx, vy);
        const sway = Math.sin(c.time * 2.2) * speed * 0.6;
        vx += -Math.sin(c.angle) * sway;
        vy += Math.cos(c.angle) * sway;
      }
      c.x += vx * dt;
      c.y += vy * dt;
    }
    if (c.body.kind === 'legged') {
      c.core.x = c.x;
      c.core.y = c.y;
      updateLegs(game, c, dt);
    } else {
      updateSegments(c);
      const mid = c.segments[Math.floor(c.segments.length / 2)];
      c.core.x = mid.x;
      c.core.y = mid.y;
    }
  }

  function update(game, dt) {
    unlock(game);
    for (const c of game.colossi) updateOne(game, c, dt);
    for (let i = game.webs.length - 1; i >= 0; i--) {
      game.webs[i].life -= dt;
      if (game.webs[i].life <= 0) game.webs.splice(i, 1);
    }
  }

  // Bienfaits des colosses apaisés (appelé par Stats.compute).
  function modify(state, stats) {
    for (const d of Vide.COLOSSI) if (status(state, d.id) === 'tamed') d.reward.modify(stats);
  }

  Vide.Colossus = {
    BODIES, ATTACKS, FOOT, def, status, lair, residentSpot, toWorld, tailPoints, pointOf, activeSeal, sealPos, knee,
    create, sync, update, hit, sealHit, pulseHit, target, hostile, modify, inCone, slowAt,
  };
})(globalThis.Vide);
