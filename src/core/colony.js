// La colonie : les êtres de lumière vivants. L'état persistant ne garde que leur nombre par espèce dans
// chaque village (village.beings) ; les êtres eux-mêmes (position, tâche…) sont recréés au chargement
// autour du cœur de leur village. Chaque être vit, travaille et se rallume dans son village.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Garden, Catalog, Structures, Villages, Territory, Grid, Walls } = Vide;

  const bySpecies = new Map();
  function species(id) {
    let sp = bySpecies.get(id);
    if (!sp) {
      sp = Vide.SPECIES.find((s) => s.id === id);
      if (!sp) throw new Error(`Espèce inconnue : ${id}`);
      bySpecies.set(id, sp);
    }
    return sp;
  }

  // Nombre d'êtres d'une espèce, tous villages confondus.
  function count(state, id) {
    return Villages.count(state, id);
  }

  // Population d'un village soumise au plafond beingCap (les espèces à plafond propre n'y comptent pas).
  function populationIn(village) {
    let n = 0;
    for (const sp of Vide.SPECIES) if (!sp.cap) n += village.beings[sp.id] || 0;
    return n;
  }

  // … et de tous les villages.
  function population(state) {
    let n = 0;
    for (const v of state.villages) n += populationIn(v);
    return n;
  }

  // Nombre d'êtres de toutes espèces.
  function total(state) {
    let n = 0;
    for (const sp of Vide.SPECIES) n += count(state, sp.id);
    return n;
  }

  // Nom affiché d'un plafond partagé.
  const CAP_LABELS = { armyCap: 'armée', builderCap: 'bâtisseurs' };

  // Êtres d'un village qui partagent le plafond `cap` (null : la population).
  function usedIn(village, cap) {
    let n = 0;
    for (const sp of Vide.SPECIES) if ((sp.cap || null) === cap) n += village.beings[sp.id] || 0;
    return n;
  }

  // Occupation et plafond qui s'appliquent à une espèce dans un village : la population (logements), l'armée
  // (casernes) ou les bâtisseurs.
  function room(state, village, sp) {
    const stats = Villages.local(state, village);
    return sp.cap
      ? { used: usedIn(village, sp.cap), max: stats[sp.cap], label: CAP_LABELS[sp.cap] || sp.cap }
      : { used: populationIn(village), max: stats.beingCap, label: 'population' };
  }

  // Prix d'un être : toujours le même (lumière, et échos pour l'armée).
  function cost(state, sp) {
    const price = { light: sp.baseCost };
    if (sp.baseEchoes) price.echoes = sp.baseEchoes;
    return price;
  }

  // Caractéristiques du village d'un être.
  function statsOf(game, b) {
    return Villages.statsOf(game, b.village);
  }

  function maxHp(game, b) {
    return species(b.species).hp * statsOf(game, b).beingHp;
  }

  // Un être éteint (vaincu par une ombre) ne fait rien jusqu'à son retour au cœur de son village.
  function isActive(b) {
    return !(b.down > 0);
  }

  // --- Êtres vivants ---

  function addBeing(colony, sp, village) {
    const r = colony.rng;
    const angle = r() * Math.PI * 2;
    const being = {
      id: colony.nextId++,
      species: sp.id,
      role: sp.role,
      village,            // son village (objet de state.villages)
      x: village.x + Math.cos(angle) * 20,
      y: village.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * 30,
      vy: Math.sin(angle) * 30,
      task: 'idle',
      target: null,       // particule visée
      carry: 0,           // nombre de particules portées
      carryValue: 0,      // valeur portée
      search: r() * 0.3,  // délai avant la prochaine recherche de cible
      wander: null,       // point de flânerie
      wanderTime: 0,
      dance: null,        // danse en cours avec un autre être
      danceCooldown: 5 + r() * 20,
      danceCheck: r() * 0.5,
      age: 0,
      phase: r() * Math.PI * 2,
      flash: 0,           // éclat bref après un dépôt (affichage)
      hp: null,           // points de vie (initialisés au premier pas, selon les améliorations)
      down: 0,            // secondes avant de se rallumer au cœur après avoir été vaincu
      lastHurt: -99,      // instant de la dernière blessure
      cd: 0,              // recharge d'attaque (armée)
    };
    colony.beings.push(being);
    return being;
  }

  function releaseTarget(being) {
    const t = being.target;
    if (t && t.claimedBy === being.id) t.claimedBy = 0;
    being.target = null;
  }

  function remove(colony, i) {
    releaseTarget(colony.beings[i]);
    colony.beings[i].removed = true;
    colony.beings.splice(i, 1);
  }

  // Aligne les êtres vivants sur les effectifs de chaque village (après un achat, un chargement…).
  function sync(game, silent) {
    const colony = game.colony;
    const { villages } = game.state;
    // Les êtres d'un village disparu (renaissance) s'en vont avec lui.
    for (let i = colony.beings.length - 1; i >= 0; i--) {
      if (!villages.includes(colony.beings[i].village)) remove(colony, i);
    }
    for (const v of villages) {
      for (const sp of Vide.SPECIES) {
        const wanted = v.beings[sp.id] || 0;
        let alive = 0;
        for (const b of colony.beings) if (b.village === v && b.species === sp.id) alive++;
        while (alive < wanted) {
          addBeing(colony, sp, v);
          alive++;
          if (!silent) Vide.Sim.emit(game, 'birth', { species: sp.id, first: count(game.state, sp.id) === 1 && alive === 1 });
        }
        while (alive > wanted) {
          let i = colony.beings.length - 1;
          while (!(colony.beings[i].village === v && colony.beings[i].species === sp.id)) i--;
          remove(colony, i);
          alive--;
        }
      }
    }
  }

  function create(game) {
    game.colony = {
      beings: [],
      nextId: 1,
      rng: util.rng(game.state.seed ^ 0x2545f491),
      glows: new Map(),                 // éclat du cœur de chaque village après des dépôts (affichage)
      flashes: new Map(),               // éclat des bâtiments après un dépôt ou une fin de chantier
      active: new Set(),                // chantiers où un bâtisseur travaille (pas précédent)
      activeNow: new Set(),             // … et pendant ce pas
      grid: Grid.create(48),            // êtres actifs, rangés par cases (rencontres, séparation)
      near: [],                         // liste réutilisée pour les requêtes de voisinage
      deposited: new Map(),             // lumière déposée dans chaque village pendant ce pas
      gains: new Map(),                 // … et ce qu'elle rapporte (multiplicateurs des êtres appliqués)
    };
    sync(game, true);
    return game.colony;
  }

  // --- Déplacements ---

  // Villages qui ont une enceinte achevée (game.walled, repris à chaque pas) : les êtres passent par leurs portes.
  let walled = [];

  // Va vers (tx, ty) ; renvoie la distance qui en sépare. Une enceinte entre les deux : par la porte la mieux placée.
  function steer(b, tx, ty, speed, dt) {
    const d = Math.hypot(tx - b.x, ty - b.y) || 1;
    const via = walled.length ? Walls.route(walled, b.x, b.y, tx, ty) : null;
    const gx = via ? via.x : tx, gy = via ? via.y : ty;
    const dx = gx - b.x, dy = gy - b.y;
    const dg = Math.hypot(dx, dy) || 1;
    // Ralentit à l'approche pour ne pas dépasser la cible (pas devant une porte).
    const s = speed * (via ? 1 : Math.min(1, dg / 30 + 0.25));
    const k = util.damp(5, dt);
    b.vx += ((dx / dg) * s - b.vx) * k;
    b.vy += ((dy / dg) * s - b.vy) * k;
    return d;
  }

  // Flânerie : vers un point au hasard du territoire de son village.
  function wander(game, b, speed, dt) {
    b.wanderTime -= dt;
    if (!b.wander || b.wanderTime <= 0 || Math.hypot(b.wander.x - b.x, b.wander.y - b.y) < 10) {
      const r = game.colony.rng;
      b.wander = Territory.randomPoint(b.village, r);
      b.wanderTime = 3 + r() * 4;
    }
    steer(b, b.wander.x, b.wander.y, speed * 0.4, dt);
  }

  function flash(game, building) {
    game.colony.flashes.set(building, 1);
  }

  function built(game, building) {
    flash(game, building);
    Vide.Sim.emit(game, 'built', { building: building.type });
  }

  // --- Rencontres : deux êtres oisifs qui se croisent dansent un instant ensemble ---

  function tryDance(game, b, dt) {
    b.danceCheck -= dt;
    if (b.danceCooldown > 0 || b.danceCheck > 0) return false;
    b.danceCheck = 0.5;
    const near = game.colony.near;
    near.length = 0;
    Grid.near(game.colony.grid, b.x, b.y, CONFIG.colony.danceRange, (o) => near.push(o));
    for (const o of near) {
      if (o === b || o.task !== 'idle' || o.dance || o.danceCooldown > 0 || !isActive(o)) continue;
      if (Math.hypot(o.x - b.x, o.y - b.y) > CONFIG.colony.danceRange) continue;
      const cx = (b.x + o.x) / 2, cy = (b.y + o.y) / 2;
      const a = Math.atan2(b.y - cy, b.x - cx);
      const time = CONFIG.colony.danceTime;
      b.dance = { cx, cy, a, t: time, partner: o.id };
      o.dance = { cx, cy, a: a + Math.PI, t: time, partner: b.id };
      Vide.Sim.emit(game, 'dance', { a: b.species, b: o.species });
      return true;
    }
    return false;
  }

  function doDance(game, b, dt, speed) {
    const d = b.dance;
    d.t -= dt;
    d.a += 2.6 * dt;
    const radius = 11 + Math.sin(d.t * 2) * 3;
    steer(b, d.cx + Math.cos(d.a) * radius, d.cy + Math.sin(d.a) * radius, speed * 1.5, dt);
    if (d.t <= 0) {
      b.dance = null;
      b.danceCooldown = 25 + game.colony.rng() * 25;
    }
  }

  // --- Comportements, choisis par le rôle de l'espèce ---

  // Où une lueur chargée doit aller : au point de dépôt le plus proche, ou ravitailler un chantier
  // actif (où un bâtisseur travaille) s'il n'est pas plus loin.
  function destination(game, b) {
    const deposit = Structures.nearestDeposit(b.village, b.x, b.y);
    const dDeposit = Math.hypot(deposit.x - b.x, deposit.y - b.y);
    let best = null;
    for (const site of game.colony.active) {
      const d = Math.hypot(site.x - b.x, site.y - b.y);
      if (d < dDeposit * 1.2 && (!best || d < best.d)) best = { x: site.x, y: site.y, site, d };
    }
    return best || deposit;
  }

  const ROLES = {
    // Récolte : chercher une particule libre du jardin, la ramasser, rapporter quand plein.
    gatherer(game, b, dt, speed) {
      const stats = statsOf(game, b);
      const c = CONFIG.colony;

      if (b.task === 'return') {
        const dest = destination(game, b);
        if (steer(b, dest.x, dest.y, speed, dt) < c.depositRadius) {
          if (dest.site) {
            if (Structures.addWork(dest.site, b.carryValue * c.feedWork)) built(game, dest.site);
            else flash(game, dest.site);
          } else {
            const { deposited, glows } = game.colony;
            deposited.set(b.village, (deposited.get(b.village) || 0) + b.carryValue * dest.mult);
            if (dest.building) flash(game, dest.building);
            else glows.set(b.village, Math.min(1, (glows.get(b.village) || 0) + 0.3));
          }
          b.carry = 0;
          b.carryValue = 0;
          b.task = 'idle';
          b.flash = 1;
        }
        return;
      }

      // Cible perdue : ramassée par le joueur, attirée par lui, ou disparue.
      const t = b.target;
      if (t && (t.gone || t.caught >= 0 || t.claimedBy !== b.id)) releaseTarget(b);

      if (!b.target) {
        b.search -= dt;
        if (b.search <= 0) {
          const p = Garden.nearestFree(game.garden, b.x, b.y, stats.beingSense, b.village.id);
          if (p) {
            p.claimedBy = b.id;
            b.target = p;
            b.task = 'seek';
          } else {
            b.search = 0.4;
          }
        }
      }

      if (b.target) {
        if (steer(b, b.target.x, b.target.y, speed, dt) < c.pickRadius) {
          Garden.take(game.garden, b.target);
          b.carry++;
          b.carryValue += b.target.value;
          b.target = null;
          b.search = 0;
          if (b.carry >= stats.beingCapacity) b.task = 'return';
        }
        return;
      }

      if (b.carry > 0) {
        b.task = 'return';
        return;
      }
      b.task = 'idle';
      if (!tryDance(game, b, dt)) wander(game, b, speed, dt);
    },

    // Construction : réparer d'abord les bâtiments abîmés, puis rejoindre le chantier le plus proche
    // et y travailler en tournant autour.
    builder(game, b, dt, speed) {
      const stats = statsOf(game, b);
      const damaged = Structures.mostDamaged(game, b.village, b.x, b.y);
      if (damaged) {
        const a = b.phase + game.time * 0.5;
        const radius = Structures.def(damaged.type).size + 10;
        steer(b, damaged.x + Math.cos(a) * radius, damaged.y + Math.sin(a) * radius, speed, dt);
        b.working = Math.hypot(damaged.x - b.x, damaged.y - b.y) < radius + 14;
        b.task = b.working ? 'repair' : 'travel';
        b.site = damaged;
        if (b.working && Structures.repair(game, damaged, stats.buildRate * CONFIG.colony.repairRate * dt)) {
          Vide.Sim.emit(game, 'repaired', { building: damaged.type });
        }
        return;
      }
      // Une brèche ou un pan abîmé : on le relève (depuis l'intérieur).
      const breach = Walls.mostDamaged(game, b.village, b.x, b.y);
      if (breach) {
        const a = b.phase + game.time * 0.5;
        steer(b, breach.x + Math.cos(a) * 12, breach.y + Math.sin(a) * 12, speed, dt);
        b.working = Math.hypot(breach.x - b.x, breach.y - b.y) < 30;
        b.task = b.working ? 'repair' : 'travel';
        b.site = null;
        if (b.working && Walls.repair(game, b.village, breach.w, breach.seg, stats.buildRate * CONFIG.colony.repairRate * dt)) {
          Vide.Sim.emit(game, 'wallRepaired', { village: b.village.type });
        }
        return;
      }
      const site = Structures.nearestSite(b.village, b.x, b.y);
      if (site) {
        const a = b.phase + game.time * 0.5;
        const radius = Structures.def(site.type).size + 10;
        steer(b, site.x + Math.cos(a) * radius, site.y + Math.sin(a) * radius, speed, dt);
        b.working = Math.hypot(site.x - b.x, site.y - b.y) < radius + 14;
        b.task = b.working ? 'build' : 'travel';
        b.site = site;
        if (b.working) {
          game.colony.activeNow.add(site);
          if (Structures.addWork(site, stats.buildRate * dt)) built(game, site);
        }
        return;
      }
      // L'enceinte en chantier : on suit son front, qui fait le tour du cœur.
      const wall = Walls.site(b.village);
      if (wall) {
        const f = Walls.front(b.village, wall);
        const r = Walls.radius(wall) - 14 + Math.sin(b.phase + game.time) * 6;
        const tx = b.village.x + Math.cos(f.a) * r, ty = b.village.y + Math.sin(f.a) * r;
        steer(b, tx, ty, speed, dt);
        b.working = Math.hypot(f.x - b.x, f.y - b.y) < 40;
        b.task = b.working ? 'build' : 'travel';
        b.site = null;
        if (b.working && Walls.addWork(wall, stats.buildRate * dt)) {
          Vide.Sim.emit(game, 'wallDone', { village: b.village.type, layers: b.village.walls.length });
        }
        return;
      }
      b.working = false;
      b.site = null;
      b.task = 'idle';
      if (!tryDance(game, b, dt)) wander(game, b, speed, dt);
    },
  };

  // Range les êtres actifs dans la grille (une fois par pas : rencontres et séparation s'en servent).
  function index(colony) {
    Grid.clear(colony.grid);
    for (const b of colony.beings) if (isActive(b)) Grid.insert(colony.grid, b);
  }

  // Les êtres s'écartent légèrement les uns des autres pour ne pas se superposer. La grille ne compare que
  // les voisins proches : des centaines d'êtres restent légers.
  function separate(colony, dt) {
    const minD = CONFIG.colony.separation;
    const grid = colony.grid;
    const near = colony.near;
    const k = Math.min(1, dt * 10);
    for (const a of colony.beings) {
      if (!isActive(a)) continue;
      near.length = 0;
      Grid.near(grid, a.x, a.y, minD, (o) => near.push(o));
      for (const b of near) {
        if (b.id <= a.id || (a.dance && b.dance)) continue; // chaque paire une fois ; les danseurs se frôlent
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((minD - d) / d) * 0.5 * k;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
  }

  // Avance la colonie d'un pas. Renvoie la lumière rapportée (multiplicateurs appliqués).
  function update(game, dt) {
    const colony = game.colony;
    colony.deposited.clear();
    colony.activeNow.clear();
    walled = game.walled;
    index(colony);
    for (const b of colony.beings) {
      const sp = species(b.species);
      const stats = statsOf(game, b);
      const slow = game.webs ? Vide.Colossus.slowAt(game, b.x, b.y) : 1;
      const speed = sp.speed * stats.beingSpeed * slow;
      const max = maxHp(game, b);
      if (b.hp === null) b.hp = max;
      if (b.down > 0) {
        b.down -= dt * stats.rekindle; // une source les rallume plus tôt
        if (b.down <= 0) {
          // Se rallume au cœur de son village, intact.
          b.down = 0;
          b.hp = max;
          b.x = b.village.x + (colony.rng() - 0.5) * 30;
          b.y = b.village.y + (colony.rng() - 0.5) * 30;
          b.vx = b.vy = 0;
          b.age = 0;
        }
        continue;
      }
      // Régénération lente loin des combats (plus rapide dans un sanctuaire).
      if (game.time - b.lastHurt > CONFIG.colony.regenDelay) b.hp = Math.min(max, b.hp + CONFIG.colony.regen * stats.regen * dt);
      b.hp = Math.min(b.hp, max);
      b.cd = Math.max(0, b.cd - dt);
      b.age += dt;
      b.flash = Math.max(0, b.flash - dt * 2);
      b.hurt = Math.max(0, (b.hurt || 0) - dt * 3);
      b.danceCooldown -= dt;
      if (b.dance) {
        b.task = 'idle';
        doDance(game, b, dt, speed);
      } else {
        ROLES[b.role](game, b, dt, speed);
      }
      const x0 = b.x, y0 = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (walled.length) {
        const wall = Walls.hold(walled, b, x0, y0, 4, true, b);
        // Arrêté par un rempart d'ombre, un soldat le frappe (une brèche finit par s'ouvrir).
        if (wall && wall.v.dark && sp.damage && b.role !== 'healer') {
          const amount = (sp.damage / sp.cooldown) * statsOf(game, b).armyDamage * (sp.breaker || 1) * dt;
          if (Walls.damage(game, wall.v, wall.w, wall.seg, amount)) Vide.Sim.emit(game, 'darkBreach', { x: b.x, y: b.y });
        }
      }
    }
    separate(colony, dt);
    // Les chantiers actifs de ce pas servent aux lueurs au pas suivant.
    [colony.active, colony.activeNow] = [colony.activeNow, colony.active];

    for (const [v, g] of colony.glows) colony.glows.set(v, g * (1 - util.damp(2, dt)));
    // Éclats des bâtiments : positifs (dépôt, fin de chantier) ou négatifs (coup d'une ombre), qui s'estompent.
    for (const [building, v] of colony.flashes) {
      const next = v > 0 ? v - dt * 1.5 : v + dt * 1.5;
      if (next * v <= 0) colony.flashes.delete(building);
      else colony.flashes.set(building, next);
    }

    // Rendement de chaque village, mesuré et lissé : il sert pendant l'absence.
    let total = 0;
    const k = util.damp(1 / CONFIG.colony.rateMemory, dt);
    colony.gains.clear();
    for (const v of game.state.villages) {
      const s = Villages.statsOf(game, v);
      const gained = (colony.deposited.get(v) || 0) * s.value * s.beingValue;
      v.rate += (gained / dt - v.rate) * k;
      if (gained > 0) colony.gains.set(v, gained);
      total += gained;
    }
    return total;
  }

  // --- Boutique ---

  for (const sp of Vide.SPECIES) {
    Catalog.register({
      id: sp.id,
      tab: 'etres',
      order: -10, // les espèces avant leurs améliorations
      name: sp.name,
      desc: sp.desc,
      revealed: (state) => count(state, sp.id) > 0 ||
        ((!sp.requires || sp.requires(state)) && state.totalLight >= sp.baseCost * 0.5),
      cost: (state) => cost(state, sp),
      // Un être s'éveille dans le village où l'on se trouve.
      blocked: (state) => {
        const village = Villages.current(state);
        if (!village) return 'rejoins un village';
        const r = room(state, village, sp);
        if (r.used < r.max) return null;
        return { armyCap: 'armée au complet : une caserne', builderCap: 'complet' }[sp.cap] || 'population pleine : un nid';
      },
      apply: (state) => {
        const village = Villages.current(state);
        village.beings[sp.id] = (village.beings[sp.id] || 0) + 1;
      },
      label: (state) => {
        const village = Villages.current(state);
        return `×${village ? village.beings[sp.id] || 0 : count(state, sp.id)}`;
      },
      effect: (state) => {
        const village = Villages.current(state);
        if (!village) return `dans tes villages : ${count(state, sp.id)}`;
        const r = room(state, village, sp);
        return `${r.label} ${r.used}/${r.max}`;
      },
    });
  }

  Vide.Colony = {
    species, count, population, populationIn, usedIn, total, room, cost, statsOf, maxHp, isActive, create, sync, update,
    // Pour les comportements définis ailleurs (armée, voir combat.js).
    ROLES, steer, wander, tryDance,
  };
})(globalThis.Vide);
