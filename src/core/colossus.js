// Les colosses vivants : marche procédurale, chasse, attaques annoncées, sceaux, apaisement.
// État persistant : state.colossi[id] = 'heard' (battement entendu) | 'found' (rencontré) | 'tamed' (apaisé) |
// 'corrupted' (pris par les ombres : hostile comme un colosse rencontré, voir corruption.js) ;
// state.studied[id] = nombre de sceaux dévoilés par les érudits (voir expeditions.js) : un sceau voilé ne se
// brise pas. Chaque sceau brisé ouvre une phase : il rugit, accélère, frappe plus vite et ajoute une attaque.
// Pendant le jeu (jamais pendant l'absence), un colosse déjà rencontré quitte parfois son repaire pour marcher sur
// un village : ses pas éteignent les bâtiments. On le détourne en le provoquant, ou en le faisant plier.
// Apaisé, il a un rôle (voir allies.js). Les corps venus avec la 1.8 (vol, cloche, nuée, dormeur) vivent dans
// beasts.js : chacun s'accroche ici par Vide.Beasts[kind] (init, chasse, mise à jour, sceaux protégés).
//   init(game, c)                     à la création
//   hunt(game, c, dt, dist, held)     déplacement en chasse (renvoie vrai : il s'oriente lui-même)
//   update(game, c, dt)               chaque pas, après le déplacement (pose, position du cœur)
//   guard(game, c)                    raison pour laquelle son sceau actif ne peut être frappé, ou null
//   aloft(c)                          vrai : hors d'atteinte du corps à corps
//   rest(game, c, dt, dist)           mode propre ('sleep') : tout le comportement
//   phase(game, c)                    à chaque sceau brisé (sauf le dernier), à la place du rugissement
// Une attaque peut aussi porter ses propres crochets (voir ATTACKS) : start, strike, step.
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
      extent: 260,    // demi-envergure (pattes comprises), pour que la caméra recule assez
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
      extent: 300,
      outline: [[135, 0], [120, 20], [90, 30], [50, 36], [20, 30], [0, 26], [-30, 52], [-80, 70], [-130, 64], [-170, 40], [-190, 0]],
    },
    serpent: {
      kind: 'serpent',
      segments: 30,
      spacing: 26,
      turn: 1.6,
      eyes: [[22, -11], [22, 11]],
      radius: 90,
      extent: 330,
    },
  };

  // Attaques : toujours annoncées (télégraphiées) avant de frapper. Les longueurs sont données pour un colosse de
  // taille REF et grandissent avec lui.
  const ATTACKS = {
    stomp: { name: 'Piétinement', telegraph: 1.4, radius: 90, damage: 40, beings: 30 },
    breath: { name: 'Souffle', telegraph: 1.6, active: 0.5, length: 650, spread: 0.3, damage: 55, beings: 35 },
    web: { name: 'Toile', telegraph: 1.2, radius: 150, duration: 7, slow: 0.35 },
    charge: { name: 'Charge', telegraph: 1.5, length: 900, width: 55, speed: 700, damage: 60, beings: 40 },
    // Phases : une onde au sol qui s'étend en anneau, percée de quelques brèches où se glisser (ou à franchir
    // d'une ruée) ; un souffle étroit qui balaie un large arc ; trois toiles d'un coup.
    quake: { name: 'Séisme', telegraph: 1.1, radius: 650, speed: 520, band: 50, gaps: 3, gap: 0.3, damage: 40, beings: 30 },
    sweep: { name: 'Balayage', telegraph: 1.2, active: 1.6, length: 600, spread: 0.13, arc: 1.2, damage: 50, beings: 30 },
    volley: { name: 'Pluie de toiles', telegraph: 1.4, radius: 130, spread: 260 },
  };
  const REF = 1.3; // taille de référence des attaques

  // Chaque phase (sceau brisé) : plus rapide, attaques plus fréquentes et mieux cachées.
  const PHASE = { speed: 0.15, cooldown: 0.18, telegraph: 0.12 };

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

  // Sceaux dévoilés par les érudits (les premiers d'abord).
  function revealed(state, id) {
    return Math.min(state.studied[id] || 0, def(id).seals.length);
  }

  // Un sceau de plus étudié. Renvoie vrai si cela en a dévoilé un.
  function study(state, id) {
    if (revealed(state, id) >= def(id).seals.length) return false;
    state.studied[id] = revealed(state, id) + 1;
    return true;
  }

  const veiled = (state, c, i) => i >= revealed(state, c.id);

  // Crochets du corps de ce colosse (voir l'en-tête), ou un objet vide.
  const NONE = {};
  const beast = (c) => (Vide.Beasts && Vide.Beasts[c.body.kind]) || NONE;

  // Phase du combat : nombre de sceaux déjà brisés.
  const phase = (c) => Math.min(c.active, c.seals.length);

  // Échelle des attaques : elles grandissent avec le colosse.
  const reach = (c) => c.def.size / REF;

  // Demi-envergure du colosse dans le monde.
  function extent(c) {
    return c.body.extent * c.def.size;
  }

  // Attaques possibles à cette phase : les siennes, plus une par sceau brisé.
  function attacksOf(c) {
    return c.def.attacks.concat((c.def.fury || []).slice(0, phase(c)));
  }

  // Repaire : une direction propre à la partie, à la distance prévue.
  function lair(state, d) {
    const angle = util.hash2(d.lair.angleSeed, 7, state.seed) * Math.PI * 2;
    return { x: Math.cos(angle) * d.lair.distance, y: Math.sin(angle) * d.lair.distance };
  }

  // Point de ronde d'un colosse apaisé : au-delà du bord du plus grand village (ou autour de l'origine), d'autant
  // plus loin qu'il est grand (`d` : sa définition) — le village reste visible au milieu de ses gardiens.
  function ring(state, d) {
    return Territory.radius(Vide.Villages.main(state)) + 250 + BODIES[d.body].extent * d.size * 0.6;
  }

  function residentSpot(state, angle, d) {
    const home = Vide.Villages.main(state);
    const r = d ? ring(state, d) : Territory.radius(home) + 250;
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
    if (at.startsWith('core:')) return c.nuclei[Number(at.slice(5))];
    if (c.body.kind === 'serpent') return c.segments[0];
    const p = c.body.points[at];
    if (!p) return { x: c.x, y: c.y }; // (un corps sans tête : ses attaques partent de son centre)
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
    // (Un colosse qui reste où il est, comme le Dormeur, ne rejoint jamais tes villages.)
    const at = tamed && !d.stays ? residentSpot(state, orbit, d) : lair(state, d);
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
      corrupt: status(state, d.id) === 'corrupted' ? 1 : (state.corruption[d.id] || 0), // noirceur (affichage)
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
    } else if (body.kind === 'serpent') {
      c.segments = [];
      for (let k = 0; k < body.segments; k++) c.segments.push({ x: at.x - k * body.spacing * d.size, y: at.y });
    }
    if (beast(c).init) beast(c).init(game, c);
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
    game.marchClock = Vide.CONFIG.colossi.marchFirst;
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
        if (Math.hypot(s.x - foot.x, s.y - foot.y) <= FOOT.shadowRadius * reach(c)) Vide.Shadows.damage(s, FOOT.shadowDamage);
      }
      return;
    }
    if (c.mode === 'calm') return;
    const r = FOOT.radius * c.def.size;
    Vide.Engines.damageAt(game, foot.x, foot.y, r + 30, Vide.CONFIG.engines.footDamage);
    // En marche sur un village : ses pas éteignent les bâtiments.
    if (c.mode === 'march') {
      const v = Vide.Villages.byId(state, c.march.village);
      for (const b of v ? v.buildings : []) {
        if (Math.hypot(b.x - foot.x, b.y - foot.y) > r + 40) continue;
        if (Vide.Structures.damage(game, b, Vide.CONFIG.colossi.footStructure)) Vide.Sim.emit(game, 'broken', { building: b.type });
      }
    }
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

  // Lance une attaque (au hasard parmi celles de la phase, ou celle demandée).
  function startAttack(game, c, forced) {
    const { player } = game.state;
    const list = attacksOf(c);
    const kind = forced || list[Math.floor(c.rng() * list.length)];
    const a = ATTACKS[kind];
    const head = pointOf(c, 'head');
    const dir = Math.atan2(player.y - head.y, player.x - head.x);
    const k = reach(c);
    if (a.start) {
      c.attack = a.start(game, c, { dir, head, k });
    } else if (kind === 'stomp') {
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
    } else if (kind === 'volley') {
      const v = game.velocity;
      const side = c.rng() * Math.PI * 2;
      c.attack = {
        kind, t: 0, phase: 'telegraph', radius: a.radius,
        webs: [
          { x: player.x, y: player.y },
          { x: player.x + v.x * 1.2, y: player.y + v.y * 1.2 },
          { x: player.x + Math.cos(side) * a.spread, y: player.y + Math.sin(side) * a.spread },
        ],
      };
    } else if (kind === 'charge') {
      c.attack = { kind, t: 0, phase: 'telegraph', origin: head, dir, length: a.length * k, width: a.width, travelled: 0, hit: false };
    } else if (kind === 'quake') {
      // Les brèches, réparties autour de lui, un peu au hasard.
      const first = c.rng() * Math.PI * 2;
      const gaps = [];
      for (let g = 0; g < a.gaps; g++) gaps.push(first + (g / a.gaps) * Math.PI * 2 + (c.rng() - 0.5) * 0.6);
      c.attack = { kind, t: 0, phase: 'telegraph', origin: { x: c.core.x, y: c.core.y }, length: a.radius * k, ring: 0, gaps, hit: false, struck: new Set() };
    } else if (kind === 'sweep') {
      const turn = c.rng() < 0.5 ? -1 : 1;
      c.attack = { kind, t: 0, phase: 'telegraph', origin: head, dir: dir - turn * a.arc, from: dir - turn * a.arc, to: dir + turn * a.arc, length: a.length * k, spread: a.spread, hit: false };
    } else {
      c.attack = { kind, t: 0, phase: 'telegraph', origin: head, dir, length: a.length * k, spread: a.spread };
    }
    // Chaque phase annonce ses coups un peu plus tard.
    c.attack.telegraph = a.telegraph / (1 + PHASE.telegraph * phase(c));
    Vide.Sim.emit(game, 'colossusAttack', { id: c.id, kind });
  }

  // L'angle (vu depuis le centre du séisme) tombe-t-il dans une brèche ?
  function inGap(atk, angle) {
    const w = ATTACKS.quake.gap;
    return atk.gaps.some((g) => {
      let diff = angle - g;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.abs(diff) <= w;
    });
  }

  // Le séisme frappe ce que son anneau traverse (hors des brèches), une fois chacun.
  function quaking(game, c, dt) {
    const atk = c.attack;
    const a = ATTACKS.quake;
    const before = atk.ring;
    atk.ring = Math.min(atk.length, atk.ring + a.speed * dt);
    const crossed = (x, y) => {
      const d = Math.hypot(x - atk.origin.x, y - atk.origin.y);
      return d >= before - a.band / 2 && d <= atk.ring + a.band / 2 && !inGap(atk, Math.atan2(y - atk.origin.y, x - atk.origin.x));
    };
    const { player } = game.state;
    if (!atk.hit && crossed(player.x, player.y)) {
      atk.hit = true;
      Vide.Combat.hurtPlayer(game, a.damage, atk.origin.x, atk.origin.y);
    }
    for (const b of game.colony.beings) {
      if (Colony.isActive(b) && !atk.struck.has(b) && crossed(b.x, b.y)) {
        atk.struck.add(b);
        Vide.Combat.hurtBeing(game, b, a.beings);
      }
    }
    for (const e of game.state.engines.slice()) {
      if (!atk.struck.has(e) && crossed(e.x, e.y)) {
        atk.struck.add(e);
        Vide.Engines.hurt(game, e, Vide.CONFIG.engines.quakeDamage);
      }
    }
    if (atk.ring >= atk.length) endAttack(c);
  }

  // Le balayage tourne d'un bord à l'autre de son arc ; il touche une fois.
  function sweeping(game, c, dt) {
    const atk = c.attack;
    const a = ATTACKS.sweep;
    const p = Math.min(1, atk.t / a.active);
    atk.dir = atk.from + (atk.to - atk.from) * p;
    const { player } = game.state;
    if (!atk.hit && inCone(atk, player.x, player.y)) {
      atk.hit = true;
      Vide.Combat.hurtPlayer(game, a.damage, atk.origin.x, atk.origin.y);
    }
    for (const b of game.colony.beings) {
      if (Colony.isActive(b) && inCone(atk, b.x, b.y)) Vide.Combat.hurtBeing(game, b, a.beings * dt * 2);
    }
  }

  function endAttack(c) {
    c.attack = null;
    c.attackCd = (3.5 + c.rng() * 2) * Math.max(0.4, 1 - PHASE.cooldown * phase(c));
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
    if (a.start) {
      if (a.strike) a.strike(game, c);
      return;
    }
    if (atk.kind === 'web' || atk.kind === 'volley') {
      const web = ATTACKS.web;
      for (const at of atk.webs || [atk.at]) {
        game.webs.push({ x: at.x, y: at.y, radius: atk.radius, life: web.duration, max: web.duration });
        Vide.Sim.emit(game, 'web', { x: at.x, y: at.y });
      }
      return;
    }
    // La charge, le séisme et le balayage frappent pendant leur course (voir charging, quaking, sweeping).
    if (atk.kind === 'charge' || atk.kind === 'quake' || atk.kind === 'sweep') return;
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
      endAttack(c);
      c.vx *= 0.2;
      c.vy *= 0.2;
    }
  }

  // Phases d'une attaque : annonce, puis frappe (instantanée, ou qui dure : souffle, balayage, séisme, charge).
  function updateAttack(game, c, dt) {
    const atk = c.attack;
    const a = ATTACKS[atk.kind];
    atk.t += dt;
    if (atk.phase === 'telegraph' && atk.t >= (atk.telegraph || a.telegraph)) {
      strike(game, c);
      if (atk.kind === 'charge' || atk.kind === 'quake' || a.active) {
        atk.phase = 'active';
        atk.t = 0;
      } else {
        endAttack(c);
      }
    } else if (atk.phase === 'active') {
      if (atk.kind === 'quake') quaking(game, c, dt);
      else if (atk.kind === 'sweep') sweeping(game, c, dt);
      else if (a.step) a.step(game, c, dt);
      if (c.attack && a.active && atk.t >= a.active) endAttack(c);
    }
  }

  // --- Sceaux, mise à genou, apaisement ---

  // Pas encore apaisé : ses sceaux peuvent être frappés (le Dormeur aussi, pendant son sommeil).
  function hostile(c) {
    return c.mode === 'roam' || c.mode === 'hunt' || c.mode === 'kneel' || c.mode === 'march' || c.mode === 'sleep';
  }

  // En combat (ou en marche sur un village) : l'armée, les balistes et les chaînes peuvent s'en prendre à lui.
  function engaged(c) {
    return c.mode === 'hunt' || c.mode === 'kneel' || c.mode === 'march';
  }

  function provoke(game, c) {
    if (c.mode !== 'roam' && c.mode !== 'march') return;
    c.mode = 'hunt';
    c.march = null;
    if (status(game.state, c.id) === 'heard') {
      game.state.colossi[c.id] = 'found';
      Vide.Sim.emit(game, 'colossusFound', { id: c.id, veiled: veiled(game.state, c, 0) });
    }
  }

  // Dégâts de l'armée : ils remplissent la jauge qui le fait plier. Le corps à corps (`melee`) n'atteint pas un
  // colosse hors de portée (en vol).
  function hit(game, c, amount, melee) {
    if (!hostile(c) || c.mode === 'sleep' || (melee && beast(c).aloft && beast(c).aloft(c))) return;
    provoke(game, c);
    if (beast(c).struck) beast(c).struck(game, c, amount);
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
    const retaken = game.state.colossi[c.id] === 'corrupted';
    game.state.colossi[c.id] = 'tamed';
    delete game.state.corruption[c.id];
    c.mode = 'calm';
    c.calmTimer = 6;
    c.attack = null;
    c.corrupt = 0;
    Vide.Sim.emit(game, retaken ? 'colossusRetaken' : 'colossusTamed', { id: c.id });
  }

  // Coup porté au sceau actif (par la pulsation) ; ×2 quand le colosse est à genou. Un sceau voilé (pas encore
  // étudié) ne réagit pas. Un sceau brisé (sauf le dernier) ouvre une phase : il se redresse en rugissant, et
  // l'onde de son rugissement part aussitôt.
  function sealHit(game, c, amount) {
    const seal = activeSeal(c);
    if (!seal || !hostile(c)) return false;
    provoke(game, c);
    if (veiled(game.state, c, c.active)) {
      Vide.Sim.emit(game, 'veiled', { id: c.id });
      return false;
    }
    const guarded = beast(c).guard && beast(c).guard(game, c);
    if (guarded) {
      Vide.Sim.emit(game, guarded, { id: c.id });
      return false;
    }
    seal.hp -= amount * (c.mode === 'kneel' ? 2 : 1);
    c.hitFlash = 1;
    if (seal.hp > 0) return false;
    seal.hp = 0;
    seal.broken = true;
    c.active++;
    const left = c.seals.length - c.active;
    Vide.Sim.emit(game, 'sealBroken', { id: c.id, left });
    if (left === 0) {
      tame(game, c);
    } else if (beast(c).phase) {
      beast(c).phase(game, c);
    } else {
      c.mode = 'hunt';
      c.kneel = 0;
      c.stagger = 0;
      startAttack(game, c, 'quake');
      Vide.Sim.emit(game, 'phase', { id: c.id, phase: phase(c), veiled: veiled(game.state, c, c.active) });
    }
    return true;
  }

  // L'onde de pulsation touche le sceau actif s'il est dans son rayon (une fois par onde).
  function pulseHit(game, x, y, radius) {
    for (const c of game.colossi) {
      // (L'onde agit sur le corps de certains colosses à chaque pas : elle disperse la Nuée.)
      if (hostile(c) && beast(c).wave) beast(c).wave(game, c, x, y, radius);
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
      if (engaged(c) && Math.hypot(c.core.x - ax, c.core.y - ay) <= radius + c.core.radius) return c.core;
    }
    return null;
  }

  // --- Marche sur un village ---

  // Un colosse rencontré, pas apaisé, qui flâne à son repaire, se met en marche vers le village le plus proche
  // (s'il est à portée). Pendant le jeu seulement ; un à la fois ; et jamais sur des villages sans défense (une
  // vie qui recommence, par exemple) : il faut une petite armée pour lui faire face.
  function startMarch(game) {
    const { state } = game;
    const M = Vide.CONFIG.colossi;
    if (game.colossi.some((c) => c.mode === 'march' || c.mode === 'hunt' || c.mode === 'kneel')) return null;
    if (Vide.Combat.armySize(state) < M.marchArmy) return null;
    const ready = game.colossi.filter((c) => c.mode === 'roam' && ['found', 'corrupted'].includes(status(state, c.id)));
    for (const c of ready) {
      const v = Vide.Villages.nearest(state, c.x, c.y);
      if (!v || Math.hypot(v.x - c.x, v.y - c.y) > M.marchRange) continue;
      c.mode = 'march';
      c.march = { village: v.id, stay: M.marchStay, arrived: false };
      c.wander = null;
      Vide.Sim.emit(game, 'march', { id: c.id, village: v.type, x: v.x, y: v.y });
      return c;
    }
    return null;
  }

  // Une patte abattue sur le bâtiment en état le plus proche (ou sur le cœur du village) : bâtiments, êtres et
  // engins alentour en pâtissent.
  function trample(game, c, v) {
    let at = { x: v.x, y: v.y };
    let best = Infinity;
    for (const b of v.buildings) {
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (Vide.Structures.isWorking(b) && d < best) {
        best = d;
        at = b;
      }
    }
    const radius = ATTACKS.stomp.radius * reach(c);
    for (const b of v.buildings) {
      if (Math.hypot(b.x - at.x, b.y - at.y) > radius) continue;
      if (Vide.Structures.damage(game, b, Vide.CONFIG.colossi.footStructure * 2)) Vide.Sim.emit(game, 'broken', { building: b.type });
    }
    for (const b of game.colony.beings) {
      if (Colony.isActive(b) && Math.hypot(b.x - at.x, b.y - at.y) <= radius) Vide.Combat.hurtBeing(game, b, ATTACKS.stomp.beings);
    }
    Vide.Engines.damageAt(game, at.x, at.y, radius, Vide.CONFIG.engines.footDamage);
    Vide.Sim.emit(game, 'quake', { points: [{ x: at.x, y: at.y }], radius, local: true });
  }

  function marching(game, c, dt) {
    const { state } = game;
    const v = Vide.Villages.byId(state, c.march.village);
    if (!v) {
      c.mode = 'roam';
      c.march = null;
      return;
    }
    const R = Territory.radius(v);
    if (!c.march.arrived) {
      if (walkTo(c, v.x, v.y, c.def.speed * 0.9, dt) > R + extent(c) * 0.3) return;
      c.march.arrived = true;
      Vide.Sim.emit(game, 'rampage', { id: c.id, village: v.type });
    }
    // Il piétine le village en tournant lentement autour de son cœur : toutes les quelques secondes, il abat une
    // patte sur le bâtiment le plus proche. Puis il s'en retourne.
    const a = Math.atan2(c.y - v.y, c.x - v.x) + 0.5;
    const r = Math.max(60, R * 0.5);
    walkTo(c, v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, c.def.speed * 0.6, dt);
    c.march.stomp = (c.march.stomp === undefined ? 1 : c.march.stomp) - dt;
    if (c.march.stomp <= 0) {
      c.march.stomp = Vide.CONFIG.colossi.stompEvery;
      trample(game, c, v);
    }
    c.march.stay -= dt;
    if (c.march.stay > 0) return;
    c.mode = 'roam';
    c.march = null;
    Vide.Sim.emit(game, 'colossusLeaves', { id: c.id, village: v.type });
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
        const k = reach(c);
        const held = c.bound ? Vide.CONFIG.engines.chain.slow : 1; // une chaîne le retient
        if (beast(c).hunt) {
          if (!beast(c).hunt(game, c, dt, dist, held)) turnTowards(c, Math.atan2(player.y - c.y, player.x - c.x), dt);
        } else {
          if (c.attack && c.attack.kind === 'charge') stop(c, dt); // il se ramasse avant de foncer
          else if (dist > 380 * k) walkTo(c, player.x, player.y, d.speed * (1 + PHASE.speed * phase(c)) * held, dt);
          else stop(c, dt);
          turnTowards(c, Math.atan2(player.y - c.y, player.x - c.x), dt);
        }
        if (c.attack) updateAttack(game, c, dt);
        else if (c.attackCd <= 0 && dist < 800 * k) startAttack(game, c);
        break;
      }
      case 'kneel':
        stop(c, dt);
        c.kneel -= dt * (c.bound ? Vide.CONFIG.engines.chain.kneel : 1);
        if (c.kneel <= 0) {
          c.mode = 'hunt';
          c.attackCd = 2;
          Vide.Sim.emit(game, 'rise', { id: c.id });
        }
        break;
      case 'march':
        marching(game, c, dt);
        if (c.mode === 'march' && dist < d.awareness && game.vitality.invulnerable <= 0) provoke(game, c);
        break;
      case 'sleep':
        beast(c).rest(game, c, dt, dist);
        break;
      case 'calm':
        stop(c, dt);
        c.calm = Math.min(1, c.calm + dt / 4);
        c.calmTimer -= dt;
        if (c.calmTimer <= 0) c.mode = 'home';
        break;
      case 'home': {
        if (d.stays) {
          c.mode = 'resident';
          break;
        }
        const spot = residentSpot(state, c.orbit, d);
        if (walkTo(c, spot.x, spot.y, 80, dt) < 80) c.mode = 'resident';
        break;
      }
      case 'resident': {
        // Son rôle d'abord (voir allies.js) ; sans rien à faire, ronde lente autour du territoire.
        const role = Vide.Allies.spot(game, c, dt);
        if (role) {
          walkTo(c, role.x, role.y, role.speed, dt);
          break;
        }
        if (d.stays) {
          stop(c, dt);
          break;
        }
        const r = ring(state, d);
        c.orbit += (16 / r) * dt;
        const spot = residentSpot(state, c.orbit, d);
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
    } else if (c.body.kind === 'serpent') {
      updateSegments(c);
      const mid = c.segments[Math.floor(c.segments.length / 2)];
      c.core.x = mid.x;
      c.core.y = mid.y;
    } else {
      c.core.x = c.x;
      c.core.y = c.y;
    }
    if (beast(c).update) beast(c).update(game, c, dt);
  }

  function update(game, dt) {
    unlock(game);
    game.marchClock -= dt;
    if (game.marchClock <= 0) {
      game.marchClock = startMarch(game) ? Vide.CONFIG.colossi.marchEvery : 30;
    }
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

  // Bienfaits propres à un village (appelé par Villages.local) : reward.local(state, village, stats).
  function modifyLocal(state, village, stats) {
    for (const d of Vide.COLOSSI) if (d.reward.local && status(state, d.id) === 'tamed') d.reward.local(state, village, stats);
  }

  Vide.Colossus = {
    BODIES, ATTACKS, PHASE, FOOT, def, status, revealed, study, veiled, phase, reach, extent, attacksOf, lair, residentSpot,
    toWorld, tailPoints, pointOf, activeSeal, sealPos, knee, create, sync, update, hit, sealHit, pulseHit, target, hostile, engaged,
    startMarch, provoke, walkTo, stop, turnTowards, endAttack, beast, tame,
    modify, modifyLocal, inCone, inGap, slowAt, startAttack,
  };
})(globalThis.Vide);
