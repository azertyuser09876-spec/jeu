// Les ombres bâtissent : des nids d'ombre, avec un cœur noir et un territoire d'obscurité qui grandit avec l'âge.
// Ils naissent après tes premiers villages (à distance de ton village le plus proche), ou t'attendent déjà dans les
// régions dangereuses lointaines. Ils lancent des raids sur tes villages ; ton armée peut les assiéger.
// État persistant : state.nests = [{ id, x, y, hp, age, region }] ; state.cleared : régions libérées pour de bon ;
// state.nestTimer : secondes avant le prochain nid près de tes villages (null tant qu'il n'y en a pas lieu).
(function (Vide) {
  'use strict';
  const { CONFIG, util, Territory, Villages, Zones } = Vide;

  const FAR_ZONES = ['murmure', 'eclat', 'gouffre'];

  function level(nest) {
    const n = CONFIG.nests;
    return Math.min(n.maxLevel, 1 + Math.floor(nest.age / n.levelEvery));
  }

  function maxHp(nest) {
    const n = CONFIG.nests;
    return n.hp + n.hpPerLevel * (level(nest) - 1);
  }

  // Rayon de son obscurité.
  function radius(nest) {
    const n = CONFIG.nests;
    return n.radius + n.radiusPerLevel * (level(nest) - 1);
  }

  function create(game) {
    game.nests = {
      raids: new Map(), defend: new Map(), lastWave: new Map(), rng: util.rng(game.state.seed ^ 0x6e657374),
    };
  }

  // Le nid dont l'obscurité couvre (x, y), ou null.
  function darkAt(state, x, y) {
    for (const nest of state.nests) if (Math.hypot(nest.x - x, nest.y - y) <= radius(nest)) return nest;
    return null;
  }

  function add(state, x, y, age, regionKey) {
    const nest = {
      id: state.nests.reduce((m, n) => Math.max(m, n.id), 0) + 1,
      x, y, hp: 0, age: age || 0, region: regionKey || null,
    };
    nest.hp = maxHp(nest);
    state.nests.push(nest);
    return nest;
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

  // Lance un raid depuis un nid vers le village le plus proche (s'il est à portée). Renvoie le nombre d'ombres.
  function raid(game, nest) {
    const { state } = game;
    const n = CONFIG.nests;
    const target = Villages.nearest(state, nest.x, nest.y);
    if (!target || Math.hypot(target.x - nest.x, target.y - nest.y) > n.raidRange) return 0;
    const rng = game.nests.rng;
    const kinds = Vide.SHADOW_KINDS.filter((k) => level(nest) >= k.fromTide / 2 + 1);
    let budget = n.raidBase + n.raidPerLevel * level(nest);
    let count = 0;
    while (budget >= 1 && game.shadows.list.length < CONFIG.shadows.max) {
      const affordable = kinds.filter((k) => k.cost <= budget);
      const k = affordable[Math.floor(rng() * affordable.length)];
      budget -= k.cost;
      const s = Vide.Shadows.spawn(game, k.id, nest.x + (rng() - 0.5) * 80, nest.y + (rng() - 0.5) * 80, 'tide');
      s.home = target;
      count++;
    }
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

    for (const nest of state.nests) {
      nest.age += dt;
      nest.hp = Math.min(maxHp(nest), nest.hp + n.regen * dt);
      // Raids.
      const clock = (g.raids.has(nest.id) ? g.raids.get(nest.id) : n.raidEvery * (0.5 + g.rng() * 0.5)) - dt;
      if (clock <= 0) {
        raid(game, nest);
        g.raids.set(nest.id, n.raidEvery + (g.rng() - 0.5) * 2 * n.raidJitter);
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

  // --- Siège ---

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
      for (let k = 0; k < n.defenders + level(nest); k++) {
        const a = rng() * Math.PI * 2;
        Vide.Shadows.spawn(game, k % 3 ? 'errante' : 'rodeuse', nest.x + Math.cos(a) * 40, nest.y + Math.sin(a) * 40, 'roam');
      }
    }
    if (nest.hp > 0) return false;
    const echoes = (n.echoes + n.echoesPerLevel * (level(nest) - 1)) * game.stats.echoGain;
    state.echoes += echoes;
    const key = nest.region || Zones.at(state.seed, nest.x, nest.y).key;
    if (!state.cleared.includes(key)) state.cleared.push(key);
    state.nests.splice(state.nests.indexOf(nest), 1);
    Vide.Sim.emit(game, 'nestDestroyed', { x: nest.x, y: nest.y, echoes, first: state.cleared.length === 1 });
    return true;
  }

  Vide.Nests = {
    FAR_ZONES, level, maxHp, radius, create, darkAt, add, spawnNear, discover, raid, update, target, nearest, hit,
  };
})(globalThis.Vide);
