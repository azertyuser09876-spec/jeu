// Les ombres bâtissent : des bases d'ombre (des « nids »), bâties comme tes villages mais en négatif. Un cœur noir,
// un territoire de noirceur (les mêmes cellules que tes territoires, en cinq nuances de noir) qui grandit avec
// l'âge sans jamais empiéter sur tes villages ; sur leur plan radial, des ouvrages (fosses, flèches : voir
// ouvrages.js) et, mûres, des remparts d'ombre. Elles naissent après tes premiers villages (à distance de ton
// village le plus proche), ou t'attendent déjà dans les régions dangereuses lointaines. Elles lancent des raids
// sur tes villages ; ton armée peut les assiéger (ouvrages, remparts, puis le cœur). Mûres, elles essaiment des
// avant-postes vers tes villages : le premier ouvre la guerre (voir war.js).
// État persistant : state.nests = [{ id, x, y, hp, age, region, area, cells, buildings: [{ type, x, y, hp }],
// walls, build, parent, swarm }] (build : secondes avant le prochain ouvrage ; parent : la base d'où vient un
// avant-poste, null pour une base ; swarm : secondes avant son prochain avant-poste) ; state.cleared : régions
// libérées pour de bon ;
// state.nestTimer : secondes avant la prochaine base près de tes villages (null tant qu'il n'y en a pas lieu).
(function (Vide) {
  'use strict';
  const { CONFIG, util, Territory, Villages, Zones } = Vide;

  // Le noir gagne ses nuances comme le blanc (voir territory.js), à son rythme.
  const DARKENING = { whitening: 1 };

  const FAR_ZONES = ['murmure', 'eclat', 'gouffre'];

  function level(nest) {
    const n = CONFIG.nests;
    return Math.min(nest.parent ? n.outpostMaxLevel : n.maxLevel, 1 + Math.floor(nest.age / n.levelEvery));
  }

  function maxHp(nest) {
    const n = CONFIG.nests;
    return n.hp + n.hpPerLevel * (level(nest) - 1);
  }

  // Rayon de sa noirceur (un avant-poste est plus petit).
  function radius(nest) {
    const n = CONFIG.nests;
    return (n.radius + n.radiusPerLevel * (level(nest) - 1)) * (nest.parent ? n.outpostSize : 1);
  }

  function create(game) {
    game.nests = {
      raids: new Map(), defend: new Map(), lastWave: new Map(), rng: util.rng(game.state.seed ^ 0x6e657374),
      towerCd: new Map(),   // recharge de chaque flèche
    };
  }

  // La base dont la noirceur couvre (x, y), ou null.
  function darkAt(state, x, y) {
    for (const nest of state.nests) if (Territory.contains(nest, x, y)) return nest;
    return null;
  }

  // Les territoires où une base ne s'étend pas : tes villages, et les autres bases.
  function others(state, nest) {
    return [...state.villages, ...state.nests.filter((o) => o !== nest)];
  }

  // Surface visée selon le niveau ; la base grandit vers elle (sans empiéter), et sa noirceur mûrit.
  function spread(state, nest, seconds) {
    nest.area = Math.max(nest.area, Math.PI * radius(nest) ** 2);
    Territory.grow(nest, others(state, nest));
    DARKENING.whitening = CONFIG.nests.darkening;
    Territory.whiten(nest, DARKENING, seconds);
  }

  // Remet les champs d'une base (une base, comme un village, se reconnaît à `dark`).
  function shape(nest) {
    nest.dark = true;
    nest.type = 'ombre';
    nest.districts = [];
    return nest;
  }

  function add(state, x, y, age, regionKey) {
    const nest = shape({
      id: state.nests.reduce((m, n) => Math.max(m, n.id), 0) + 1,
      x, y, hp: 0, age: age || 0, region: regionKey || null,
      area: 0, cells: [], buildings: [], walls: [], build: CONFIG.nests.buildEvery,
      parent: null, swarm: CONFIG.nests.outpostEvery, faction: null, creatures: {},
    });
    nest.faction = Vide.Factions.inherit(state, null, Vide.DARK_FACTIONS, nest.id);
    nest.hp = maxHp(nest);
    state.nests.push(nest);
    spread(state, nest, 0);
    // Une base déjà mûre (lointaine) a déjà bâti.
    while (fortify(state, nest)) { /* tout ce que son âge permet */ }
    for (const w of nest.walls) w.work = Vide.Walls.workOf(w);
    return nest;
  }

  // --- Ouvrages ---

  // Nombre d'ouvrages de ce type qu'une base de ce niveau peut avoir.
  function allowed(nest, d) {
    const l = level(nest);
    return l < d.from ? 0 : Math.min(d.max, 1 + Math.floor((l - d.from) / d.every));
  }

  const countOf = (nest, type) => nest.buildings.filter((b) => b.type === type).length;

  // Remparts d'ombre qu'une base de ce niveau peut avoir.
  function wallsAllowed(nest) {
    const l = level(nest);
    return CONFIG.nests.wallLevels.filter((x) => l >= x).length;
  }

  // La base bâtit ce qui lui manque (un ouvrage, ou un rempart). Renvoie ce qu'elle a commencé, ou null.
  function fortify(state, nest) {
    for (const d of Vide.DARK_WORKS) {
      if (countOf(nest, d.id) >= allowed(nest, d)) continue;
      const at = Vide.Plan.choose(nest, d);
      if (!at) continue;
      const work = { type: d.id, x: at.x, y: at.y, hp: d.hp };
      nest.buildings.push(work);
      return work;
    }
    if (nest.walls.length < wallsAllowed(nest) && !Vide.Walls.site(nest)) return Vide.Walls.plan(nest);
    // Sa garnison de bêtes.
    const beast = Vide.Creatures.reinforce(nest);
    return beast ? { type: beast } : null;
  }

  // Ce que rapportent ses fosses : ombres de plus par raid, défenseurs de plus.
  function bonus(nest, key) {
    let n = 0;
    for (const b of nest.buildings) n += Vide.darkWork(b.type)[key] || 0;
    return n;
  }

  // Un nid près de tes villages : à bonne distance du plus proche, et loin de tous les autres villages.
  function spawnNear(state, rng) {
    const n = CONFIG.nests;
    const base = state.villages[Math.floor(rng() * state.villages.length)];
    for (let tries = 0; tries < 24; tries++) {
      const a = rng() * Math.PI * 2;
      const d = n.spawnDistance[0] + rng() * (n.spawnDistance[1] - n.spawnDistance[0]);
      const x = base.x + Math.cos(a) * d, y = base.y + Math.sin(a) * d;
      const clear = state.villages.every((v) => Math.hypot(v.x - x, v.y - y) - Territory.radius(v) > n.spawnDistance[0] * 0.7);
      const apart = state.nests.every((o) => Math.hypot(o.x - x, o.y - y) > 1500);
      if (clear && apart) return add(state, x, y, 0, null);
    }
    return null;
  }

  // Loin de l'origine, une région dangereuse peut abriter un nid déjà mûr : on le découvre en approchant.
  function discover(state, region) {
    const n = CONFIG.nests;
    if (!FAR_ZONES.includes(region.zone.id) || state.cleared.includes(region.key)) return null;
    if (state.nests.some((x) => x.region === region.key) || state.nests.length >= n.max * 2) return null;
    if (util.hash2(region.i, region.j, state.seed + 5309) > n.farChance) return null;
    const c = Zones.center(region.i, region.j, state.seed);
    if (Math.hypot(c.x, c.y) < n.farFrom) return null;
    return add(state, c.x, c.y, n.levelEvery * 3, region.key);
  }

  // --- Avant-postes ---

  // Une base mûre essaime : un avant-poste sur le chemin de ton village le plus proche, à bonne distance de tes
  // villages et des autres bases. Renvoie l'avant-poste, ou null s'il n'y a pas la place.
  function spawnOutpost(state, base) {
    const n = CONFIG.nests;
    const target = Villages.nearest(state, base.x, base.y);
    if (!target) return null;
    const dist = Math.hypot(target.x - base.x, target.y - base.y);
    if (dist > n.outpostRange) return null;
    const toward = Math.atan2(target.y - base.y, target.x - base.x);
    const d = util.clamp(dist * 0.45, n.outpostDistance[0], n.outpostDistance[1]);
    for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
      const x = base.x + Math.cos(toward + off) * d, y = base.y + Math.sin(toward + off) * d;
      const clear = state.villages.every((v) => Math.hypot(v.x - x, v.y - y) - Territory.radius(v) > n.outpostGap);
      const apart = state.nests.every((o) => Math.hypot(o.x - x, o.y - y) - Territory.radius(o) > n.outpostGap * 0.7);
      if (!clear || !apart) continue;
      const outpost = add(state, x, y, 0, null);
      outpost.parent = base.id;
      outpost.faction = Vide.Factions.inherit(state, base.faction, Vide.DARK_FACTIONS, outpost.id);
      outpost.swarm = 0;
      return outpost;
    }
    return null;
  }

  const outposts = (state, base) => state.nests.filter((o) => o.parent === base.id).length;

  // L'horloge d'essaimage d'une base. Renvoie l'avant-poste né, ou null.
  function swarm(state, base, seconds) {
    const n = CONFIG.nests;
    // Seules les bases nées près de tes villages essaiment (celles des régions lointaines restent chez elles).
    if (base.parent || base.region || level(base) < n.outpostLevel) return null;
    base.swarm -= seconds * Vide.War.pace(state);
    if (base.swarm > 0) return null;
    base.swarm = n.outpostEvery;
    if (outposts(state, base) >= n.outpostsPer || state.nests.length >= n.max * 3) return null;
    return spawnOutpost(state, base);
  }

  // Pendant la tension, un avant-poste n'envoie que des rôdeuses : elles tournent autour de ton village, sans
  // attaquer, puis s'en vont.
  function prowl(game, nest, target) {
    const rng = game.nests.rng;
    let count = 0;
    for (let k = 0; k < CONFIG.war.prowlers && game.shadows.list.length < CONFIG.shadows.max; k++) {
      const s = Vide.Shadows.spawn(game, 'rodeuse', nest.x + (rng() - 0.5) * 80, nest.y + (rng() - 0.5) * 80, 'tide');
      s.home = target;
      s.calm = true;
      s.ttl = CONFIG.war.prowlTime;
      count++;
    }
    Vide.Sim.emit(game, 'prowl', { x: nest.x, y: nest.y, village: target.type, count });
    return count;
  }

  // Lance un raid depuis une base vers le village le plus proche (s'il est à portée). Renvoie le nombre d'ombres.
  function raid(game, nest) {
    const { state } = game;
    const n = CONFIG.nests;
    const target = Villages.nearest(state, nest.x, nest.y);
    if (!target || Math.hypot(target.x - nest.x, target.y - nest.y) > n.raidRange) return 0;
    if (nest.parent && Vide.War.calm(state)) return prowl(game, nest, target);
    const rng = game.nests.rng;
    const kinds = Vide.SHADOW_KINDS.filter((k) => level(nest) >= k.fromTide / 2 + 1);
    let budget = (n.raidBase + n.raidPerLevel * level(nest) + bonus(nest, 'raid')) * Vide.War.raidScale(state);
    let count = 0;
    while (budget >= 1 && game.shadows.list.length < CONFIG.shadows.max) {
      const affordable = kinds.filter((k) => k.cost <= budget);
      const k = affordable[Math.floor(rng() * affordable.length)];
      budget -= k.cost;
      const s = Vide.Shadows.spawn(game, k.id, nest.x + (rng() - 0.5) * 80, nest.y + (rng() - 0.5) * 80, 'tide');
      s.home = target;
      s.faction = nest.faction;
      count++;
    }
    // Une base mûre lâche aussi ses bêtes.
    count += Vide.Creatures.raid(game, nest, target);
    Vide.Sim.emit(game, 'raid', { x: nest.x, y: nest.y, village: target.type, count });
    return count;
  }

  function update(game, dt) {
    const { state } = game;
    const n = CONFIG.nests;
    const g = game.nests;

    // Un nid près de tes villages après le deuxième, puis un autre de temps en temps.
    let founded = 0;
    for (const v of state.villages) founded += 1 + (v.districts ? v.districts.length : 0);
    if (state.nestTimer === null && founded >= n.firstAfter) state.nestTimer = n.firstDelay;
    if (state.nestTimer !== null && state.villages.length) {
      state.nestTimer -= dt;
      if (state.nestTimer <= 0) {
        state.nestTimer = n.every;
        if (state.nests.filter((x) => !x.region).length < n.max) {
          const nest = spawnNear(state, g.rng);
          if (nest) Vide.Sim.emit(game, 'nest', { x: nest.x, y: nest.y, first: state.nests.length === 1 });
        }
      }
    }
    if (game.region) {
      const nest = discover(state, game.region);
      if (nest) Vide.Sim.emit(game, 'nest', { x: nest.x, y: nest.y, far: true, first: state.nests.length === 1 });
    }

    Vide.War.advance(state, dt);
    const pace = Vide.War.pace(state);
    for (const nest of state.nests.slice()) {
      nest.age += dt;
      nest.hp = Math.min(maxHp(nest), nest.hp + n.regen * dt);
      spread(state, nest, dt);
      // Elle essaime : le premier avant-poste ouvre la guerre.
      const outpost = swarm(state, nest, dt);
      if (outpost) {
        Vide.Sim.emit(game, 'outpost', { x: outpost.x, y: outpost.y, first: !state.war });
        if (Vide.War.begin(state)) Vide.Sim.emit(game, 'war', { x: outpost.x, y: outpost.y });
      }
      // Elle bâtit, et monte ses remparts d'elle-même.
      nest.build -= dt * pace;
      if (nest.build <= 0) {
        nest.build = n.buildEvery;
        const done = fortify(state, nest);
        if (done) Vide.Sim.emit(game, 'nestBuilt', { x: nest.x, y: nest.y, kind: done.type || 'rempart' });
      }
      const wall = Vide.Walls.site(nest);
      if (wall) Vide.Walls.addWork(wall, n.wallWork * dt);
      shoot(game, nest, dt);
      // Raids.
      const clock = (g.raids.has(nest.id) ? g.raids.get(nest.id) : n.raidEvery * (0.5 + g.rng() * 0.5)) - dt;
      if (clock <= 0) {
        raid(game, nest);
        g.raids.set(nest.id, (n.raidEvery + (g.rng() - 0.5) * 2 * n.raidJitter) / pace);
      } else {
        g.raids.set(nest.id, clock);
      }
    }

    // L'obscurité épuise la lumière, hors de tes territoires.
    const { player } = state;
    if (darkAt(state, player.x, player.y) && !Territory.isInside(state, player.x, player.y)) {
      const v = game.vitality;
      if (v.invulnerable <= 0) {
        v.hp -= n.drain * dt;
        v.lastHurt = game.time;
        if (v.hp <= 0) Vide.Combat.disperse(game);
      }
    }
  }

  // Les flèches tirent sur la lumière à leur portée : toi d'abord, puis tes êtres, puis tes expéditions.
  function shoot(game, nest, dt) {
    const { state } = game;
    const g = game.nests;
    for (const b of nest.buildings) {
      const d = Vide.darkWork(b.type);
      if (!d.tower) continue;
      const cd = (g.towerCd.get(b) || 0) - dt;
      if (cd > 0) {
        g.towerCd.set(b, cd);
        continue;
      }
      const { range, damage } = d.tower;
      let target = null;
      const p = state.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) <= range) target = { x: p.x, y: p.y, hit: () => Vide.Combat.hurtPlayer(game, damage, b.x, b.y) };
      if (!target && game.colony.grid) {
        let best = null, bestD = range;
        Vide.Grid.near(game.colony.grid, b.x, b.y, range, (o) => {
          const dd = Math.hypot(o.x - b.x, o.y - b.y);
          if (dd <= bestD && Vide.Colony.isActive(o)) {
            bestD = dd;
            best = o;
          }
        });
        if (best) target = { x: best.x, y: best.y, hit: () => Vide.Combat.hurtBeing(game, best, damage) };
      }
      if (!target) {
        const e = state.expeditions.find((x) => Math.hypot(x.x - b.x, x.y - b.y) <= range);
        if (e) target = { x: e.x, y: e.y, hit: () => Vide.Expeditions.hurt(state, e, damage) };
      }
      if (!target) {
        g.towerCd.set(b, 0.3); // personne à portée : elle regarde de nouveau un peu plus tard
        continue;
      }
      g.towerCd.set(b, d.tower.cooldown);
      target.hit();
      Vide.Sim.emit(game, 'darkBolt', { x: b.x, y: b.y, tx: target.x, ty: target.y });
    }
  }

  // --- Siège ---

  // Un ouvrage, vu comme une cible (objet stable).
  const workTargets = new WeakMap();
  function workTarget(nest, b) {
    let t = workTargets.get(b);
    if (!t) {
      t = { nest, work: b, radius: Vide.darkWork(b.type).size, x: b.x, y: b.y };
      workTargets.set(b, t);
    }
    t.hp = b.hp;
    return t;
  }

  // L'ouvrage le plus proche de (x, y) (les flèches d'abord), ou null.
  function nearestWork(nest, x, y) {
    let best = null, bestScore = Infinity;
    for (const b of nest.buildings) {
      const score = Math.hypot(b.x - x, b.y - y) + (Vide.darkWork(b.type).tower ? 0 : 400);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  // Frappe un ouvrage ; renvoie vrai s'il s'effondre.
  function hitWork(game, nest, b, amount) {
    if (!nest.buildings.includes(b)) return false;
    b.hp -= amount;
    if (b.hp > 0) return false;
    nest.buildings.splice(nest.buildings.indexOf(b), 1);
    const echoes = CONFIG.nests.workEchoes * game.stats.echoGain;
    game.state.echoes += echoes;
    Vide.Sim.emit(game, 'workDown', { x: b.x, y: b.y, kind: b.type, echoes });
    return true;
  }

  // Le cœur d'un nid, vu comme une cible (objet stable : l'armée peut le viser plusieurs fois).
  const targets = new WeakMap();
  function target(nest) {
    let t = targets.get(nest);
    if (!t) {
      t = { nest, radius: 28, x: nest.x, y: nest.y };
      targets.set(nest, t);
    }
    t.hp = nest.hp;
    return t;
  }

  // Le nid le plus proche de (x, y), à portée de siège, ou null.
  function nearest(state, x, y, range) {
    let best = null;
    let bestD = range === undefined ? Infinity : range;
    for (const nest of state.nests) {
      const d = Math.hypot(nest.x - x, nest.y - y);
      if (d < bestD) {
        bestD = d;
        best = nest;
      }
    }
    return best;
  }

  // Frappe le cœur d'un nid. Attaqué, il fait jaillir des défenseurs ; détruit, il rend beaucoup d'échos et sa
  // région est libérée pour de bon. Renvoie vrai s'il vient d'être détruit.
  function hit(game, nest, amount) {
    const { state } = game;
    const n = CONFIG.nests;
    if (!state.nests.includes(nest)) return false;
    nest.hp -= amount;
    const last = game.nests.defend.get(nest.id);
    if (last === undefined || game.time - last >= n.defendEvery) {
      game.nests.defend.set(nest.id, game.time);
      const rng = game.nests.rng;
      for (let k = 0; k < n.defenders + level(nest) + bonus(nest, 'defenders'); k++) {
        const a = rng() * Math.PI * 2;
        Vide.Shadows.spawn(game, k % 3 ? 'errante' : 'rodeuse', nest.x + Math.cos(a) * 40, nest.y + Math.sin(a) * 40, 'roam');
      }
    }
    if (nest.hp > 0) return false;
    const echoes = (n.echoes + n.echoesPerLevel * (level(nest) - 1)) * game.stats.echoGain;
    state.echoes += echoes;
    const key = nest.region || Zones.at(state.seed, nest.x, nest.y).key;
    if (!state.cleared.includes(key)) state.cleared.push(key);
    const taken = fall(state, nest);
    Vide.Sim.emit(game, 'nestDestroyed', {
      x: nest.x, y: nest.y, echoes, first: state.cleared.length === 1,
      village: taken ? taken.village.type : null, cells: taken ? taken.cells : 0,
    });
    return true;
  }

  // Le village dont le territoire touche celui de la base, ou null.
  function neighbor(state, nest) {
    const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const v of state.villages) {
      for (let k = 0; k < nest.cells.length; k += 3) {
        const i = nest.cells[k], j = nest.cells[k + 1];
        for (const [di, dj] of N) if (Territory.has(v, i + di, j + dj)) return v;
      }
    }
    return null;
  }

  // Une base tombe : ses ouvrages et ses remparts s'effondrent ; son terrain retourne au vide, ou rejoint ton
  // village s'il le touche (une lumière neuve, qui devra blanchir). Renvoie { village, cells } ou null.
  function fall(state, nest) {
    state.nests.splice(state.nests.indexOf(nest), 1);
    const heir = neighbor(state, nest);
    if (!heir) return null;
    let cells = 0;
    for (let k = 0; k < nest.cells.length; k += 3) {
      const i = nest.cells[k], j = nest.cells[k + 1];
      if (Territory.has(heir, i, j) || Territory.owned(state.nests, i, j)) continue;
      heir.cells.push(i, j, 0);
      cells++;
    }
    heir.area += cells * Territory.CELL * Territory.CELL;
    return { village: heir, cells };
  }

  // Pendant l'absence : elles vieillissent, grandissent, noircissent, bâtissent, essaiment (sans raid) ; la guerre
  // mûrit, ou s'ouvre. Le temps passe par tranches (un avant-poste né en route vit le reste de l'absence).
  // Renvoie { outposts, war } : avant-postes nés, guerre ouverte pendant l'absence.
  function offline(state, seconds) {
    const n = CONFIG.nests;
    const report = { outposts: 0, war: false };
    const lived = new Map(state.nests.map((x) => [x, 0]));
    const STEP = n.outpostEvery / 2;
    for (let left = seconds; left > 1e-9; left -= STEP) {
      const dt = Math.min(STEP, left);
      Vide.War.advance(state, dt);
      const pace = Vide.War.pace(state);
      for (const nest of state.nests.slice()) {
        nest.age += dt;
        lived.set(nest, lived.get(nest) + dt);
        spread(state, nest, 0);
        if (swarm(state, nest, dt)) {
          report.outposts++;
          if (Vide.War.begin(state)) report.war = true;
        }
        nest.build -= dt * pace;
        while (nest.build <= 0) {
          nest.build += n.buildEvery;
          if (!fortify(state, nest)) {
            nest.build = n.buildEvery;
            break;
          }
        }
        const wall = Vide.Walls.site(nest);
        if (wall) Vide.Walls.addWork(wall, n.wallWork * dt);
      }
      for (const nest of state.nests) if (!lived.has(nest)) lived.set(nest, 0);
    }
    // Leur noirceur a mûri le temps qu'elles ont vécu.
    for (const nest of state.nests) spread(state, nest, lived.get(nest) || 0);
    return report;
  }

  Vide.Nests = {
    FAR_ZONES, level, maxHp, radius, create, darkAt, others, spread, shape, add, allowed, wallsAllowed, fortify, bonus,
    spawnNear, discover, spawnOutpost, swarm, prowl, raid, update, shoot, offline, neighbor, fall, target, workTarget, nearestWork, hitWork, nearest, hit,
  };
})(globalThis.Vide);
