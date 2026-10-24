// La colonie : les êtres de lumière vivants. L'état persistant ne garde que leur nombre par espèce
// (state.beings) ; les êtres eux-mêmes (position, tâche…) sont recréés au chargement autour du foyer.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Garden, Catalog } = Vide;

  function species(id) {
    const sp = Vide.SPECIES.find((s) => s.id === id);
    if (!sp) throw new Error(`Espèce inconnue : ${id}`);
    return sp;
  }

  function count(state, id) {
    return state.beings[id] || 0;
  }

  function population(state) {
    let n = 0;
    for (const sp of Vide.SPECIES) n += count(state, sp.id);
    return n;
  }

  function cost(state, sp) {
    return Math.ceil(sp.baseCost * Math.pow(sp.growth, count(state, sp.id)));
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
      target: null,     // particule visée
      carry: 0,         // nombre de particules portées
      carryValue: 0,    // valeur portée
      search: r() * 0.3,// délai avant la prochaine recherche de cible
      wander: null,     // point de flânerie
      wanderTime: 0,
      age: 0,
      phase: r() * Math.PI * 2,
      flash: 0,         // éclat bref après un dépôt (affichage)
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

  // --- Comportements, choisis par le rôle de l'espèce ---

  const ROLES = {
    // Récolte : chercher une particule libre du jardin, la ramasser, rapporter au foyer quand plein.
    gatherer(game, b, dt, speed) {
      const { stats } = game;
      const c = CONFIG.colony;

      if (b.task === 'return') {
        if (steer(b, 0, 0, speed, dt) < c.depositRadius) {
          game.colony.deposited += b.carryValue;
          b.carry = 0;
          b.carryValue = 0;
          b.task = 'idle';
          b.flash = 1;
          game.colony.foyerGlow = Math.min(1, game.colony.foyerGlow + 0.3);
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
      wander(game, b, speed, dt);
    },
  };

  // Les êtres s'écartent légèrement les uns des autres pour ne pas se superposer.
  function separate(beings, dt) {
    const minD = CONFIG.colony.separation;
    for (let i = 0; i < beings.length; i++) {
      const a = beings[i];
      for (let j = i + 1; j < beings.length; j++) {
        const b = beings[j];
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

  // Avance la colonie d'un pas. Renvoie la lumière rapportée au foyer (multiplicateurs appliqués).
  function update(game, dt) {
    const colony = game.colony;
    const { stats } = game;
    colony.deposited = 0;
    for (const b of colony.beings) {
      const sp = species(b.species);
      b.age += dt;
      b.flash = Math.max(0, b.flash - dt * 2);
      ROLES[b.role](game, b, dt, sp.speed * stats.beingSpeed);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    separate(colony.beings, dt);
    colony.foyerGlow *= 1 - util.damp(2, dt);

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
      cost: (state) => ({ light: cost(state, sp) }),
      blocked: (state) => (population(state) >= Vide.Stats.compute(state).beingCap ? 'population pleine' : null),
      apply: (state) => { state.beings[sp.id] = count(state, sp.id) + 1; },
      label: (state) => `×${count(state, sp.id)}`,
      effect: (state) => `population ${population(state)}/${Vide.Stats.compute(state).beingCap}`,
    });
  }

  Vide.Colony = { species, count, population, cost, create, sync, update };
})(globalThis.Vide);
