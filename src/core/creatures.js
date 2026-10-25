// Les créatures intermédiaires : plus grandes et plus travaillées que les êtres, plus petites qu'un colosse, aux
// corps articulés (des pattes, des anneaux : voir draw-creatures.js). Chacune est d'un camp — 'light' (elle
// appartient à un village), 'shadow' (à une base, ou lâchée dans un raid) ou 'wild' (la faune du vide) — et peut en
// changer : à bout de forces, si la sous-faction de qui la frappe retourne les créatures de son camp (voir
// factions.js), elle est apprivoisée, purifiée ou corrompue au lieu de mourir, et rejoint ce village ou cette base.
// Sinon, elle meurt (et laisse des échos à la lumière).
// État persistant : village.creatures et nest.creatures = { espèce: nombre } (les créatures attachées : gardiens
// d'un village, garnison d'une base). Les bêtes lâchées dans un raid ne vivent que dans game.creatures.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Shadows, Colony, Territory, Villages, Walls, Catalog } = Vide;

  //   body      'quadruped' (quatre pattes) ou 'segments' (un corps d'anneaux) ; length : longueur du corps (ou d'un
  //             anneau) ; antlers : des bois
  //   hp, speed, damage, cooldown, radius ; echoes : échos laissés à la lumière qui l'abat
  //   baseCost, baseEchoes : si présents, elle s'achète (un gardien par village, deux chez les Éleveurs)
  //   wild      si présent, la faune du vide : { zones, weight, shy (elle fuit la lumière à cette distance), max }
  //   worth     stats invisibles : ce qu'en attend le gouverneur d'une base qui l'ajoute à sa garnison (governors.js)
  Vide.CREATURES = [
    { id: 'loup', name: 'Loup', body: 'quadruped', length: 44, hp: 320, speed: 95, damage: 12, cooldown: 0.9,
      radius: 16, echoes: 8, worth: { guard: 0.5, raid: 0.3 } },
    { id: 'scolopendre', name: 'Scolopendre', fem: true, body: 'segments', segments: 16, length: 22, hp: 1100, speed: 52,
      damage: 26, cooldown: 1.6, radius: 24, echoes: 25, worth: { guard: 1.2, raid: 0.4 } },
    { id: 'cerf', name: 'Cerf', body: 'quadruped', antlers: true, length: 56, hp: 700, speed: 82, damage: 20,
      cooldown: 1.2, radius: 22, echoes: 15, baseCost: 20000, baseEchoes: 20 },
    // La faune du vide : neutre, elle ne fait de mal à personne ; les Éleveurs et les Meutes l'apprivoisent.
    { id: 'lucioles', name: 'Lucioles', plural: true, fem: true, body: 'swarm', length: 26, hp: 70, speed: 115,
      damage: 3, cooldown: 0.8, radius: 18, echoes: 2,
      wild: { zones: ['calme', 'brume', 'courants', 'murmure'], weight: 4, shy: 230 } },
    { id: 'raie', name: 'Raie de lumière', fem: true, body: 'ray', length: 42, hp: 160, speed: 55, damage: 7,
      cooldown: 1.2, radius: 22, echoes: 4, wild: { zones: ['brume', 'courants', 'murmure', 'eclat'], weight: 3 } },
    { id: 'baleine', name: 'Baleine du vide', fem: true, body: 'whale', length: 230, hp: 3000, speed: 26,
      damage: 30, cooldown: 2.5, radius: 70, echoes: 60, wild: { zones: ['eclat', 'gouffre'], weight: 1, max: 1 } },
  ];

  function kind(id) {
    const k = Vide.CREATURES.find((c) => c.id === id);
    if (!k) throw new Error(`Créature inconnue : ${id}`);
    return k;
  }

  const hostile = (a, b) => (a === 'light' && b === 'shadow') || (a === 'shadow' && b === 'light');

  function create(game) {
    game.creatures = { list: [], nextId: 1, rng: util.rng(game.state.seed ^ 0x62657374), faunaClock: 0 };
    sync(game);
  }

  // Une créature, posée en (x, y). `owner` : son village ou sa base (null : lâchée dans un raid, ou sauvage).
  function spawn(game, kindId, side, owner, x, y) {
    const k = kind(kindId);
    const g = game.creatures;
    const c = {
      creature: true, id: g.nextId++, kind: k.id, side, owner, home: null,
      x, y, vx: 0, vy: 0, angle: g.rng() * Math.PI * 2, radius: k.radius,
      hp: k.hp, maxHp: k.hp, cd: 0, phase: g.rng() * 100, walked: 0, flash: 0, turned: 0,
      target: null, retarget: 0, trail: null,
    };
    if (k.body === 'segments') {
      c.trail = [];
      for (let i = 0; i < k.segments; i++) c.trail.push({ x: x - Math.cos(c.angle) * k.length * i, y: y - Math.sin(c.angle) * k.length * i });
    }
    g.list.push(c);
    return c;
  }

  // Les créatures attachées (gardiens des villages, garnisons des bases) suivent les nombres de l'état.
  function sync(game) {
    const { state } = game;
    const g = game.creatures;
    const owners = [...state.villages, ...state.nests];
    for (let i = g.list.length - 1; i >= 0; i--) {
      const c = g.list[i];
      if (c.owner && !owners.includes(c.owner)) g.list.splice(i, 1);
    }
    for (const o of owners) {
      const side = o.dark ? 'shadow' : 'light';
      for (const k of Vide.CREATURES) {
        const wanted = (o.creatures && o.creatures[k.id]) || 0;
        let alive = 0;
        for (const c of g.list) if (c.owner === o && c.kind === k.id) alive++;
        while (alive < wanted) {
          const a = g.rng() * Math.PI * 2;
          spawn(game, k.id, side, o, o.x + Math.cos(a) * 60, o.y + Math.sin(a) * 60);
          alive++;
        }
        while (alive > wanted) {
          const i = g.list.findIndex((c) => c.owner === o && c.kind === k.id);
          g.list.splice(i, 1);
          alive--;
        }
      }
    }
  }

  // --- Coups, mort, conversion ---

  // Ajoute n créatures de cette espèce à un village ou une base (les nombres restent rangés dans l'ordre du
  // catalogue, comme au chargement).
  const count = (o, id, n) => {
    if (!o) return;
    const now = { ...(o.creatures || {}) };
    now[id] = Math.max(0, (now[id] || 0) + n);
    o.creatures = {};
    for (const k of Vide.CREATURES) if (now[k.id]) o.creatures[k.id] = now[k.id];
  };

  // Ce que la sous-faction de qui frappe fait d'une créature à bout de forces : le nom de la sous-faction qui la
  // retourne, ou null (elle mourra).
  function converter(c, by) {
    const f = by && Vide.Factions.def(by.faction);
    return f && f.convert.includes(c.side) ? f : null;
  }

  // Frappe une créature. `by` : { side, faction, owner, creature } de qui frappe. Renvoie 'converted', 'down' ou
  // null.
  function hit(game, c, amount, by) {
    if (c.hp <= 0 || !game.creatures.list.includes(c)) return null;
    const f = by && Vide.Factions.def(by.faction);
    if (f && f.creatureDamage) amount *= f.creatureDamage;
    c.hp -= amount;
    c.flash = 1;
    c.lastBy = by || null;
    const turn = converter(c, by);
    if (turn && c.hp <= c.maxHp * CONFIG.creatures.convertAt) return convert(game, c, by, turn) ? 'converted' : null;
    if (c.hp > 0) return null;
    die(game, c, by);
    return 'down';
  }

  // Elle change de camp : elle quitte son maître et rejoint celui de qui l'a abattue (le village le plus proche de
  // la sous-faction du joueur, pour ta pulsation).
  function convert(game, c, by, f) {
    const { state } = game;
    let owner = by.owner;
    if (!owner && by.side === 'light') owner = Villages.nearest(state, c.x, c.y);
    if (!owner && by.side === 'shadow') owner = Vide.Nests.nearest(state, c.x, c.y);
    if (!owner) {
      die(game, c, by);
      return false;
    }
    count(c.owner, c.kind, -1);
    count(owner, c.kind, 1);
    const from = c.side;
    c.side = owner.dark ? 'shadow' : 'light';
    c.owner = owner;
    c.home = null;
    c.target = null;
    c.hp = c.maxHp * CONFIG.creatures.convertHp;
    c.turned = 1;
    Vide.Sim.emit(game, 'converted', {
      kind: c.kind, from, to: c.side, faction: f.id, verb: f.verb, x: c.x, y: c.y, owner: owner.dark ? null : owner.type,
    });
    return true;
  }

  function die(game, c, by) {
    const { state } = game;
    const g = game.creatures;
    g.list.splice(g.list.indexOf(c), 1);
    count(c.owner, c.kind, -1);
    const k = kind(c.kind);
    let echoes = 0;
    if (by && by.side === 'light') {
      const f = Vide.Factions.def(by.faction);
      echoes = k.echoes * game.stats.echoGain * ((f && f.creatureEchoes) || 1);
      state.echoes += echoes;
    }
    // Les Dévoreurs se nourrissent de leurs proies.
    const f = by && Vide.Factions.def(by.faction);
    if (f && f.feed && by.creature && by.creature.hp > 0) {
      by.creature.hp = Math.min(by.creature.maxHp, by.creature.hp + by.creature.maxHp * f.feed);
    }
    Vide.Sim.emit(game, 'creatureDown', { kind: c.kind, side: c.side, x: c.x, y: c.y, echoes });
  }

  // La créature la plus proche de (x, y), dans un rayon, d'un camp hostile à `side` (filtre facultatif).
  function nearestEnemy(game, x, y, side, range, filter) {
    let best = null;
    let bestD2 = range * range;
    for (const c of game.creatures.list) {
      if (c.hp <= 0 || !hostile(side, c.side) || (filter && !filter(c))) continue;
      const d2 = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = c;
      }
    }
    return best;
  }

  // Ce qu'une créature du camp de la lumière inflige : sa sous-faction (et celle de son village).
  function by(c) {
    return { side: c.side, faction: c.owner ? c.owner.faction : c.faction || null, owner: c.owner, creature: c };
  }

  // --- Comportements ---

  // Une proie pour une bête des ombres : toi, tes êtres, tes créatures, tes bâtiments, le cœur visé.
  function prey(game, c, range) {
    const { state } = game;
    let best = null;
    let bestD2 = range * range;
    const consider = (type, ref, x, y, village) => {
      const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { type, ref, x, y, village };
      }
    };
    if (!game.vitality.invulnerable) consider('player', state.player, state.player.x, state.player.y);
    for (const b of game.colony.beings) if (Colony.isActive(b)) consider('being', b, b.x, b.y);
    for (const o of game.creatures.list) if (o.side === 'light' && o.hp > 0) consider('creature', o, o.x, o.y);
    for (const v of state.villages) {
      for (const b of v.buildings) if (Vide.Structures.isWorking(b)) consider('building', b, b.x, b.y, v);
      consider('heart', v, v.x, v.y);
    }
    return best;
  }

  // Ennemi d'une créature de la lumière, dans la zone que l'armée défend (voir Combat.anchor).
  function foe(game, c, a) {
    const shadow = Shadows.nearest(game, c.x, c.y, Infinity, (s) => Math.hypot(s.x - a.x, s.y - a.y) <= a.radius);
    const beast = nearestEnemy(game, c.x, c.y, 'light', Infinity, (o) => Math.hypot(o.x - a.x, o.y - a.y) <= a.radius);
    if (shadow && beast) return Math.hypot(shadow.x - c.x, shadow.y - c.y) < Math.hypot(beast.x - c.x, beast.y - c.y) ? shadow : beast;
    if (shadow || beast) return shadow || beast;
    if (a.nest) {
      const work = Vide.Nests.nearestWork(a.nest, c.x, c.y);
      return work ? Vide.Nests.workTarget(a.nest, work) : Vide.Nests.target(a.nest);
    }
    return null;
  }

  // Frappe ce qu'elle vise (selon ce que c'est).
  function strike(game, c, t, amount) {
    const k = kind(c.kind);
    if (t.creature) {
      hit(game, t, amount, by(c));
    } else if (t.work) {
      Vide.Nests.hitWork(game, t.nest, t.work, amount);
    } else if (t.nest) {
      Vide.Nests.hit(game, t.nest, amount);
    } else if (t.type) {
      // Une proie d'une bête des ombres.
      if (t.type === 'creature') hit(game, t.ref, amount, by(c));
      else Vide.Combat.strike(game, c, t, amount);
    } else {
      Shadows.damage(t, amount); // une ombre
    }
    c.cd = k.cooldown;
  }

  function steer(c, tx, ty, speed, dt) {
    const dx = tx - c.x, dy = ty - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const s = speed * Math.min(1, d / 40 + 0.2);
    const k = util.damp(3, dt);
    c.vx += ((dx / d) * s - c.vx) * k;
    c.vy += ((dy / d) * s - c.vy) * k;
    return d;
  }

  // --- La faune du vide ---

  // Autour de la lumière, quelques bêtes sauvages selon la zone ; celles restées loin derrière s'effacent. Celles
  // qui errent dans le territoire d'une base de Meutes finissent dans la meute.
  function fauna(game, dt) {
    const { state } = game;
    const g = game.creatures;
    const c = CONFIG.creatures;
    for (const w of g.list.slice()) {
      if (w.side !== 'wild') continue;
      const nest = Vide.Nests.darkAt(state, w.x, w.y);
      const f = nest && Vide.Factions.def(nest.faction);
      if (f && f.convert.includes('wild')) {
        w.taming = (w.taming || 0) + dt;
        if (w.taming >= c.packTame) convert(game, w, { side: 'shadow', faction: nest.faction, owner: nest }, f);
      }
    }
    g.faunaClock -= dt;
    if (g.faunaClock > 0 || !game.region) return;
    g.faunaClock = c.faunaEvery;
    const p = state.player;
    for (let i = g.list.length - 1; i >= 0; i--) {
      const w = g.list[i];
      if (w.side === 'wild' && Math.hypot(w.x - p.x, w.y - p.y) > c.faunaFar) g.list.splice(i, 1);
    }
    const zone = game.region.zone.id;
    const wanted = c.fauna[zone] || 0;
    const near = g.list.filter((w) => w.side === 'wild' && Math.hypot(w.x - p.x, w.y - p.y) < c.faunaNear).length;
    if (near >= wanted) return;
    const kinds = Vide.CREATURES.filter((k) => k.wild && k.wild.zones.includes(zone)
      && !(k.wild.max && g.list.filter((w) => w.kind === k.id && w.side === 'wild').length >= k.wild.max));
    if (!kinds.length) return;
    let roll = g.rng() * kinds.reduce((s, k) => s + k.wild.weight, 0);
    const k = kinds.find((x) => (roll -= x.wild.weight) < 0) || kinds[0];
    const a = g.rng() * Math.PI * 2;
    const d = c.faunaSpawn[0] + g.rng() * (c.faunaSpawn[1] - c.faunaSpawn[0]);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (Villages.at(state, x, y) || Vide.Nests.darkAt(state, x, y)) return;
    const w = spawn(game, k.id, 'wild', null, x, y);
    w.anchor = { x, y };
  }

  // Une bête sauvage erre autour de son lieu, le déplace peu à peu ; les plus farouches fuient la lumière, et toutes
  // fuient ce qui vient de les frapper.
  function roam(game, c, k, dt) {
    const p = game.state.player;
    const g = game.creatures;
    if (c.lastBy && c.flash > 0.3) {
      c.fleeing = 3;
      c.fleeFrom = { x: c.lastBy.creature ? c.lastBy.creature.x : p.x, y: c.lastBy.creature ? c.lastBy.creature.y : p.y };
    }
    c.fleeing = Math.max(0, (c.fleeing || 0) - dt);
    const shy = k.wild.shy && Math.hypot(p.x - c.x, p.y - c.y) < k.wild.shy;
    if (c.fleeing > 0 || shy) {
      const from = c.fleeing > 0 ? c.fleeFrom : p;
      const dx = c.x - from.x, dy = c.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: c.x + (dx / d) * 300, y: c.y + (dy / d) * 300, speed: k.speed };
    }
    if (!c.goal || Math.hypot(c.goal.x - c.x, c.goal.y - c.y) < 30 || g.rng() < dt * 0.05) {
      const anchor = c.anchor || (c.anchor = { x: c.x, y: c.y });
      anchor.x += (g.rng() - 0.5) * 200;
      anchor.y += (g.rng() - 0.5) * 200;
      const a = g.rng() * Math.PI * 2, r = 120 + g.rng() * 380;
      c.goal = { x: anchor.x + Math.cos(a) * r, y: anchor.y + Math.sin(a) * r };
    }
    return { x: c.goal.x, y: c.goal.y, speed: k.speed * 0.45 };
  }

  function update(game, dt) {
    const { state } = game;
    const g = game.creatures;
    sync(game);
    fauna(game, dt);
    for (const c of g.list.slice()) {
      if (c.hp <= 0) continue;
      const k = kind(c.kind);
      c.cd = Math.max(0, c.cd - dt);
      c.flash = Math.max(0, c.flash - dt * 3);
      c.turned = Math.max(0, c.turned - dt * 0.6);
      c.retarget -= dt;
      // Dans tes territoires, la lumière ronge les bêtes des ombres (lentement), comme les ombres.
      if (c.side === 'shadow') {
        const over = Villages.at(state, c.x, c.y);
        if (over) {
          c.hp -= CONFIG.shadows.territoryBurn * Villages.statsOf(game, over).burn * dt;
          if (c.hp <= 0) {
            die(game, c, { side: 'light', faction: over.faction, owner: over, creature: null });
            continue;
          }
        }
      }
      let goal = null;
      let enemy = null;
      if (c.side === 'light') {
        const a = Vide.Combat.anchor(game, { village: c.owner });
        if (c.retarget <= 0 || !c.target || c.target.hp <= 0) {
          c.target = foe(game, c, a);
          c.retarget = 0.4;
        }
        enemy = c.target;
        if (!enemy) {
          // Ronde autour du village (ou cortège de la lumière, en escorte).
          const ang = c.phase * 0.1 + game.time * 0.05;
          const r = state.army.posture === 'escorte' ? 90 : Math.max(80, Territory.radius(c.owner) * 0.55);
          goal = { x: a.x + Math.cos(ang) * r, y: a.y + Math.sin(ang) * r };
        }
      } else if (c.side === 'shadow') {
        if (c.retarget <= 0 || !c.target || (c.target.ref && c.target.ref.hp <= 0)) {
          const base = c.owner && c.owner.dark ? c.owner : null;
          const range = base ? Territory.radius(base) + 400 : CONFIG.creatures.sense;
          c.target = prey(game, c, range);
          if (base && c.target && Math.hypot(c.target.x - base.x, c.target.y - base.y) > range) c.target = null;
          c.retarget = 0.5;
        }
        enemy = c.target;
        if (enemy && enemy.ref) {
          enemy.x = enemy.ref.x;
          enemy.y = enemy.ref.y;
        }
        if (!enemy) {
          const base = c.owner && c.owner.dark ? c.owner : null;
          if (base) {
            const ang = c.phase * 0.1 + game.time * 0.06;
            const r = Math.max(60, Territory.radius(base) * 0.5);
            goal = { x: base.x + Math.cos(ang) * r, y: base.y + Math.sin(ang) * r };
          } else if (c.home && state.villages.includes(c.home)) {
            goal = { x: c.home.x, y: c.home.y };
          }
        }
      }
      let speed = k.speed;
      if (c.side === 'wild') {
        const r = roam(game, c, k, dt);
        goal = { x: r.x, y: r.y };
        speed = r.speed * 2; // (goal se suit à mi-vitesse)
      }
      if (enemy) {
        const reach = k.radius + (enemy.radius || (enemy.type === 'building' ? 16 : enemy.type === 'heart' ? 24 : 8)) + 6;
        let tx = enemy.x, ty = enemy.y;
        const via = c.side === 'light' && game.walled.length ? Walls.route(game.walled, c.x, c.y, tx, ty) : null;
        if (via) {
          tx = via.x;
          ty = via.y;
        }
        const d = Math.hypot(enemy.x - c.x, enemy.y - c.y);
        if (d > reach) steer(c, tx, ty, speed, dt);
        else {
          c.vx *= 1 - util.damp(6, dt);
          c.vy *= 1 - util.damp(6, dt);
          if (c.cd <= 0) strike(game, c, enemy, k.damage);
        }
      } else if (goal) {
        steer(c, goal.x, goal.y, speed * 0.5, dt);
      } else {
        c.vx *= 1 - util.damp(2, dt);
        c.vy *= 1 - util.damp(2, dt);
      }
      const x0 = c.x, y0 = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      // Les murailles : celles du camp d'en face l'arrêtent ; elle frappe le pan qui la bloque.
      if (game.walled.length) {
        const wall = Walls.hold(game.walled, c, x0, y0, k.radius * 0.6, c.side === 'light', c);
        if (wall && c.cd <= 0 && wall.v.dark === (c.side === 'light')) {
          c.cd = k.cooldown;
          if (Walls.damage(game, wall.v, wall.w, wall.seg, k.damage)) {
            Vide.Sim.emit(game, wall.v.dark ? 'darkBreach' : 'breach', { village: wall.v.type, x: c.x, y: c.y });
          }
        }
      }
      body(c, k, dt);
    }
  }

  // Le corps : son orientation, sa démarche, et ses anneaux qui suivent la tête.
  function body(c, k, dt) {
    const speed = Math.hypot(c.vx, c.vy);
    c.walked += speed * dt;
    if (speed > 4) {
      let diff = Math.atan2(c.vy, c.vx) - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += diff * util.damp(6, dt);
    }
    if (c.trail) {
      c.trail[0].x = c.x;
      c.trail[0].y = c.y;
      for (let i = 1; i < c.trail.length; i++) {
        const a = c.trail[i - 1], b = c.trail[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        b.x = a.x + (dx / d) * k.length;
        b.y = a.y + (dy / d) * k.length;
      }
    }
  }

  // --- Bêtes des ombres : garnisons des bases, meutes des raids ---

  // Garnison qu'une base de ce niveau entretient : { espèce: nombre }.
  function garrison(nest) {
    const l = Vide.Nests.level(nest);
    const packs = (Vide.Factions.def(nest.faction) || {}).packs || 1;
    const out = {};
    if (l >= CONFIG.creatures.garrisonFrom) out.loup = Math.round((1 + Math.floor((l - CONFIG.creatures.garrisonFrom) / 2)) * packs);
    if (l >= CONFIG.creatures.scolopendreFrom) out.scolopendre = 1;
    return out;
  }

  // Une base complète sa garnison (une bête de plus). Renvoie l'espèce, ou null.
  function reinforce(nest) {
    const want = garrison(nest);
    for (const [id, n] of Object.entries(want)) {
      if (((nest.creatures || {})[id] || 0) < n) {
        count(nest, id, 1);
        return id;
      }
    }
    return null;
  }

  // Un raid d'une base mûre lâche une meute (et, plus mûre encore, une scolopendre) — avec la guerre seulement,
  // une fois la tension passée. Renvoie le nombre de bêtes.
  function raid(game, nest, target) {
    const c = CONFIG.creatures;
    const l = Vide.Nests.level(nest);
    const rng = game.creatures.rng;
    if (!game.state.war || Vide.War.calm(game.state)) return 0;
    if (l < c.raidFrom || rng() > c.raidChance) return 0;
    const packs = (Vide.Factions.def(nest.faction) || {}).packs || 1;
    let n = 0;
    const wolves = Math.round((2 + Math.floor((l - c.raidFrom) / 2)) * packs);
    for (let i = 0; i < wolves; i++) {
      const w = spawn(game, 'loup', 'shadow', null, nest.x + (rng() - 0.5) * 120, nest.y + (rng() - 0.5) * 120);
      w.home = target;
      w.faction = nest.faction;
      n++;
    }
    if (l >= c.scolopendreFrom && rng() < 0.35) {
      const s = spawn(game, 'scolopendre', 'shadow', null, nest.x, nest.y);
      s.home = target;
      n++;
    }
    return n;
  }

  // --- Le cerf : un gardien qui s'achète ---

  const CERF = kind('cerf');
  Catalog.register({
    id: 'cerf',
    tab: 'village',
    group: 'créatures',
    name: 'Cerf de lumière',
    desc: 'Une grande bête de lumière, gardienne du village : elle combat les ombres et leurs bêtes. Un par village '
      + '(deux chez les Éleveurs). À bout de forces face à des Corrupteurs, elle pourrait passer à l’ombre.',
    revealed: (state) => state.stats.shadows > 0 && state.villages.length > 0 && state.totalLight >= CERF.baseCost * 0.3,
    cost: () => ({ light: CERF.baseCost, echoes: CERF.baseEchoes }),
    blocked: (state) => {
      const v = Villages.current(state);
      if (!v) return 'rejoins un village';
      const max = v.faction === 'eleveurs' ? 2 : 1;
      return ((v.creatures || {}).cerf || 0) >= max ? `${max === 1 ? 'un cerf' : 'deux cerfs'} par village` : null;
    },
    apply: (state) => { count(Villages.current(state), 'cerf', 1); },
    label: (state) => {
      const v = Villages.current(state);
      return v && v.creatures && v.creatures.cerf ? `×${v.creatures.cerf}` : '';
    },
    effect: () => `vie ${CERF.hp} · coups ${CERF.damage}`,
  });

  Vide.Creatures = {
    kind, hostile, create, spawn, sync, hit, convert, die, nearestEnemy, by, update, garrison, reinforce, raid, count,
    fauna,
  };
})(globalThis.Vide);
