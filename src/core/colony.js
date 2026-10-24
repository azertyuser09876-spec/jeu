// La colonie : les êtres de lumière vivants. L'état persistant ne garde que leur nombre par espèce
// (state.beings) ; les êtres eux-mêmes (position, tâche…) sont recréés au chargement autour du foyer.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Garden, Catalog, Structures } = Vide;

  function species(id) {
    const sp = Vide.SPECIES.find((s) => s.id === id);
    if (!sp) throw new Error(`Espèce inconnue : ${id}`);
    return sp;
  }

  function count(state, id) {
    return state.beings[id] || 0;
  }

  // Population soumise au plafond beingCap (les espèces à plafond propre n'y comptent pas).
  function population(state) {
    let n = 0;
    for (const sp of Vide.SPECIES) if (!sp.cap) n += count(state, sp.id);
    return n;
  }

  // Nombre d'êtres de toutes espèces.
  function total(state) {
    let n = 0;
    for (const sp of Vide.SPECIES) n += count(state, sp.id);
    return n;
  }

  // Occupation et plafond qui s'appliquent à une espèce.
  function room(state, sp) {
    const stats = Vide.Stats.compute(state);
    return sp.cap
      ? { used: count(state, sp.id), max: stats[sp.cap], label: sp.name.toLowerCase() + 's' }
      : { used: population(state), max: stats.beingCap, label: 'population' };
  }

  // Coût du prochain être d'une espèce : lumière, et échos pour l'armée.
  function cost(state, sp) {
    const n = count(state, sp.id);
    const price = { light: Math.ceil(sp.baseCost * Math.pow(sp.growth, n)) };
    if (sp.baseEchoes) price.echoes = Math.ceil(sp.baseEchoes * Math.pow(sp.echoGrowth, n));
    return price;
  }

  function maxHp(game, b) {
    return species(b.species).hp * game.stats.beingHp;
  }

  // Un être éteint (vaincu par une ombre) ne fait rien jusqu'à son retour au foyer.
  function isActive(b) {
    return !(b.down > 0);
  }

  // --- Êtres vivants ---

  function addBeing(colony, sp) {
    const r = colony.rng;
    const angle = r() * Math.PI * 2;
    const being = {
      id: colony.nextId++,
      species: sp.id,
      role: sp.role,
      x: Math.cos(angle) * 20,
      y: Math.sin(angle) * 20,
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
      down: 0,            // secondes avant de se rallumer au foyer après avoir été vaincu
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

  // Aligne les êtres vivants sur les effectifs de l'état (après un achat, un chargement…).
  function sync(game, silent) {
    const colony = game.colony;
    for (const sp of Vide.SPECIES) {
      const wanted = count(game.state, sp.id);
      let alive = colony.beings.filter((b) => b.species === sp.id).length;
      while (alive < wanted) {
        addBeing(colony, sp);
        alive++;
        if (!silent) Vide.Sim.emit(game, 'birth', { species: sp.id, first: alive === 1 });
      }
      while (alive > wanted) {
        const i = colony.beings.map((b) => b.species).lastIndexOf(sp.id);
        releaseTarget(colony.beings[i]);
        colony.beings.splice(i, 1);
        alive--;
      }
    }
  }

  function create(game) {
    game.colony = {
      beings: [],
      nextId: 1,
      rng: util.rng(game.state.seed ^ 0x2545f491),
      rate: game.state.colonyRate || 0, // lumière par seconde rapportée par la colonie (lissée)
      foyerGlow: 0,                     // éclat du foyer après des dépôts (affichage)
      flashes: new Map(),               // éclat des bâtiments après un dépôt ou une fin de chantier
      active: new Set(),                // chantiers où un bâtisseur travaille (pas précédent)
      activeNow: new Set(),             // … et pendant ce pas
      deposited: 0,
    };
    sync(game, true);
    return game.colony;
  }

  // --- Déplacements ---

  function steer(b, tx, ty, speed, dt) {
    const dx = tx - b.x, dy = ty - b.y;
    const d = Math.hypot(dx, dy) || 1;
    // Ralentit à l'approche pour ne pas dépasser la cible.
    const s = speed * Math.min(1, d / 30 + 0.25);
    const k = util.damp(5, dt);
    b.vx += ((dx / d) * s - b.vx) * k;
    b.vy += ((dy / d) * s - b.vy) * k;
    return d;
  }

  function wander(game, b, speed, dt) {
    const radius = Vide.Territory.radius(game.state) * 0.7;
    b.wanderTime -= dt;
    if (!b.wander || b.wanderTime <= 0 || Math.hypot(b.wander.x - b.x, b.wander.y - b.y) < 10) {
      const r = game.colony.rng;
      const angle = r() * Math.PI * 2;
      const dist = Math.max(30, radius) * Math.sqrt(r());
      b.wander = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
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
    for (const o of game.colony.beings) {
      if (o === b || o.task !== 'idle' || o.dance || o.danceCooldown > 0) continue;
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
    const deposit = Structures.nearestDeposit(game.state, b.x, b.y);
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
      const { stats } = game;
      const c = CONFIG.colony;

      if (b.task === 'return') {
        const dest = destination(game, b);
        if (steer(b, dest.x, dest.y, speed, dt) < c.depositRadius) {
          if (dest.site) {
            if (Structures.addWork(dest.site, b.carryValue * c.feedWork)) built(game, dest.site);
            else flash(game, dest.site);
          } else {
            game.colony.deposited += b.carryValue * dest.mult;
            if (dest.building) flash(game, dest.building);
            else game.colony.foyerGlow = Math.min(1, game.colony.foyerGlow + 0.3);
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
          const p = Garden.nearestFree(game.garden, b.x, b.y, stats.beingSense);
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
      const damaged = Structures.mostDamaged(game, b.x, b.y);
      if (damaged) {
        const a = b.phase + game.time * 0.5;
        const radius = Structures.def(damaged.type).size + 10;
        steer(b, damaged.x + Math.cos(a) * radius, damaged.y + Math.sin(a) * radius, speed, dt);
        b.working = Math.hypot(damaged.x - b.x, damaged.y - b.y) < radius + 14;
        b.task = b.working ? 'repair' : 'travel';
        b.site = damaged;
        if (b.working && Structures.repair(game, damaged, game.stats.buildRate * CONFIG.colony.repairRate * dt)) {
          Vide.Sim.emit(game, 'repaired', { building: damaged.type });
        }
        return;
      }
      const site = Structures.nearestSite(game.state, b.x, b.y);
      if (site) {
        const a = b.phase + game.time * 0.5;
        const radius = Structures.def(site.type).size + 10;
        steer(b, site.x + Math.cos(a) * radius, site.y + Math.sin(a) * radius, speed, dt);
        b.working = Math.hypot(site.x - b.x, site.y - b.y) < radius + 14;
        b.task = b.working ? 'build' : 'travel';
        b.site = site;
        if (b.working) {
          game.colony.activeNow.add(site);
          if (Structures.addWork(site, game.stats.buildRate * dt)) built(game, site);
        }
        return;
      }
      b.working = false;
      b.site = null;
      b.task = 'idle';
      if (!tryDance(game, b, dt)) wander(game, b, speed, dt);
    },
  };

  // Les êtres s'écartent légèrement les uns des autres pour ne pas se superposer.
  function separate(beings, dt) {
    const minD = CONFIG.colony.separation;
    for (let i = 0; i < beings.length; i++) {
      const a = beings[i];
      if (!isActive(a)) continue;
      for (let j = i + 1; j < beings.length; j++) {
        const b = beings[j];
        if (!isActive(b)) continue;
        if (a.dance && b.dance) continue; // les danseurs se frôlent
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((minD - d) / d) * 0.5 * Math.min(1, dt * 10);
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
      }
    }
  }

  // Avance la colonie d'un pas. Renvoie la lumière rapportée (multiplicateurs appliqués).
  function update(game, dt) {
    const colony = game.colony;
    const { stats } = game;
    colony.deposited = 0;
    colony.activeNow.clear();
    for (const b of colony.beings) {
      const sp = species(b.species);
      const slow = game.webs ? Vide.Colossus.slowAt(game, b.x, b.y) : 1;
      const speed = sp.speed * stats.beingSpeed * slow;
      const max = maxHp(game, b);
      if (b.hp === null) b.hp = max;
      if (b.down > 0) {
        b.down -= dt;
        if (b.down <= 0) {
          // Se rallume au foyer, intact.
          b.down = 0;
          b.hp = max;
          b.x = (colony.rng() - 0.5) * 30;
          b.y = (colony.rng() - 0.5) * 30;
          b.vx = b.vy = 0;
          b.age = 0;
        }
        continue;
      }
      // Régénération lente loin des combats.
      if (game.time - b.lastHurt > CONFIG.colony.regenDelay) b.hp = Math.min(max, b.hp + CONFIG.colony.regen * dt);
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
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    separate(colony.beings, dt);
    // Les chantiers actifs de ce pas servent aux lueurs au pas suivant.
    [colony.active, colony.activeNow] = [colony.activeNow, colony.active];

    colony.foyerGlow *= 1 - util.damp(2, dt);
    // Éclats des bâtiments : positifs (dépôt, fin de chantier) ou négatifs (coup d'une ombre), qui s'estompent.
    for (const [building, v] of colony.flashes) {
      const next = v > 0 ? v - dt * 1.5 : v + dt * 1.5;
      if (next * v <= 0) colony.flashes.delete(building);
      else colony.flashes.set(building, next);
    }

    const gained = colony.deposited * stats.value * stats.beingValue;
    colony.rate += (gained / dt - colony.rate) * util.damp(1 / CONFIG.colony.rateMemory, dt);
    game.state.colonyRate = colony.rate;
    return gained;
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
      blocked: (state) => {
        const r = room(state, sp);
        return r.used >= r.max ? (sp.cap ? 'complet' : 'population pleine') : null;
      },
      apply: (state) => { state.beings[sp.id] = count(state, sp.id) + 1; },
      label: (state) => `×${count(state, sp.id)}`,
      effect: (state) => {
        const r = room(state, sp);
        return `${r.label} ${r.used}/${r.max}`;
      },
    });
  }

  Vide.Colony = {
    species, count, population, total, room, cost, maxHp, isActive, create, sync, update,
    // Pour les comportements définis ailleurs (armée, voir combat.js).
    ROLES, steer, wander, tryDance,
  };
})(globalThis.Vide);
