// Bâtiments du territoire : planification, emplacement, construction, effets.
// État persistant : state.buildings = [{ type, x, y, work }] ; un bâtiment est achevé quand work ≥ def.work.
(function (Vide) {
  'use strict';
  const { util, Catalog, Territory } = Vide;

  const MIN_TERRITORY = 80; // rayon minimal pour bâtir

  function def(type) {
    const d = Vide.BUILDINGS.find((b) => b.id === type);
    if (!d) throw new Error(`Bâtiment inconnu : ${type}`);
    return d;
  }

  function isDone(building) {
    return building.work >= def(building.type).work;
  }

  // Nombre de bâtiments d'un type (achevés seulement, ou tous en comptant les chantiers).
  function count(state, type, includeSites) {
    let n = 0;
    for (const b of state.buildings) if (b.type === type && (includeSites || isDone(b))) n++;
    return n;
  }

  // Bâtiments d'un type qui fonctionnent (achevés et non éteints).
  function working(state, type) {
    let n = 0;
    for (const b of state.buildings) if (b.type === type && isWorking(b)) n++;
    return n;
  }

  function sites(state) {
    return state.buildings.filter((b) => !isDone(b));
  }

  function cost(state, d) {
    const n = count(state, d.id, true);
    const price = { light: Math.ceil(d.baseCost * Math.pow(d.growth, n)) };
    if (d.baseEchoes) price.echoes = Math.ceil(d.baseEchoes * Math.pow(d.echoGrowth, n));
    return price;
  }

  // Un bâtiment fonctionne s'il est achevé et n'a pas été éteint par les ombres.
  function isWorking(building) {
    return isDone(building) && !building.broken;
  }

  // --- Solidité (dans game.structureHp, recalculée au chargement : un bâtiment éteint repart de zéro) ---

  function hp(game, building) {
    const known = game.structureHp.get(building);
    if (known !== undefined) return known;
    return building.broken ? 0 : def(building.type).hp;
  }

  // Blesse un bâtiment achevé. Renvoie vrai s'il vient de s'éteindre.
  function damage(game, building, amount) {
    if (!isWorking(building)) return false;
    const left = hp(game, building) - amount;
    game.structureHp.set(building, Math.max(0, left));
    if (left > 0) return false;
    building.broken = true;
    return true;
  }

  // Répare un bâtiment. Renvoie vrai s'il était éteint et fonctionne de nouveau.
  function repair(game, building, amount) {
    const max = def(building.type).hp;
    const now = Math.min(max, hp(game, building) + amount);
    if (now < max) {
      game.structureHp.set(building, now);
      return false;
    }
    game.structureHp.delete(building);
    if (!building.broken) return false;
    building.broken = false;
    return true;
  }

  // Bâtiment achevé le plus abîmé à réparer (les éteints d'abord, puis le plus proche), ou null.
  function mostDamaged(game, x, y) {
    let best = null;
    let bestScore = Infinity;
    for (const b of game.state.buildings) {
      if (!isDone(b) || hp(game, b) >= def(b.type).hp) continue;
      const score = (b.broken ? 0 : 1e9) + Math.hypot(b.x - x, b.y - y);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  // Choisit un emplacement : à la distance voulue du foyer, le plus loin possible des autres bâtiments.
  // Déterministe : un même état donne toujours le même emplacement.
  function site(state, d) {
    const radius = Territory.radius(state);
    const dist = util.clamp(d.ring * radius, 50, radius * 0.9);
    const rng = util.rng(state.seed ^ Math.imul(state.buildings.length + 1, 0x9e3779b1));
    const start = rng() * Math.PI * 2;
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < 24; i++) {
      const a = start + (i / 24) * Math.PI * 2;
      const x = Math.cos(a) * dist, y = Math.sin(a) * dist;
      let score = Infinity;
      for (const b of state.buildings) score = Math.min(score, Math.hypot(b.x - x, b.y - y));
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }

  function plan(state, type) {
    const d = def(type);
    const at = site(state, d);
    const building = { type, x: at.x, y: at.y, work: 0 };
    state.buildings.push(building);
    return building;
  }

  // Ajoute du travail à un chantier ; renvoie vrai s'il vient d'être achevé.
  function addWork(building, amount) {
    if (isDone(building)) return false;
    building.work = Math.min(def(building.type).work, building.work + amount);
    return isDone(building);
  }

  function nearestSite(state, x, y) {
    let best = null;
    let bestD2 = Infinity;
    for (const b of state.buildings) {
      if (isDone(b)) continue;
      const d2 = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
    }
    return best;
  }

  // Point de dépôt le plus proche pour une lueur : le foyer, ou un relais (prisme) achevé.
  function nearestDeposit(state, x, y) {
    let best = { x: 0, y: 0, mult: 1, building: null };
    let bestD2 = x * x + y * y;
    for (const b of state.buildings) {
      const d = def(b.type);
      if (!d.deposit || !isWorking(b)) continue;
      const d2 = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { x: b.x, y: b.y, mult: d.deposit, building: b };
      }
    }
    return best;
  }

  // Effets des bâtiments achevés sur les caractéristiques (appelé par Stats.compute).
  function modify(state, stats) {
    for (const d of Vide.BUILDINGS) {
      if (!d.modify) continue;
      const n = working(state, d.id);
      if (n > 0) d.modify(stats, n);
    }
  }

  // Pendant l'absence, les bâtisseurs continuent les chantiers dans l'ordre. Renvoie les bâtiments achevés.
  function advanceOffline(state, stats, seconds) {
    const builders = state.beings.batisseur || 0;
    let budget = builders * stats.buildRate * seconds;
    const done = [];
    for (const b of state.buildings) {
      if (budget <= 0) break;
      if (isDone(b)) continue;
      const need = def(b.type).work - b.work;
      const used = Math.min(need, budget);
      budget -= used;
      if (addWork(b, used)) done.push(b.type);
    }
    return done;
  }

  for (const d of Vide.BUILDINGS) {
    Catalog.register({
      id: d.id,
      tab: 'batiments',
      name: d.name,
      desc: d.desc,
      revealed: (state) => count(state, d.id, true) > 0 ||
        ((state.beings.lueur || 0) > 0 && (!d.requires || d.requires(state)) && state.totalLight >= d.baseCost * 0.4),
      cost: (state) => cost(state, d),
      blocked: (state) => {
        if (!(state.beings.batisseur > 0)) return 'il faut un bâtisseur';
        if (Territory.radius(state) < MIN_TERRITORY) return 'territoire trop petit';
        return null;
      },
      apply: (state) => { plan(state, d.id); },
      label: (state) => {
        const built = count(state, d.id, false);
        const pending = count(state, d.id, true) - built;
        return pending ? `×${built} · ${pending} en chantier` : `×${built}`;
      },
      effect: () => d.effectText,
    });
  }

  Vide.Structures = {
    def, isDone, isWorking, count, working, sites, cost, site, plan, addWork, nearestSite, nearestDeposit,
    modify, advanceOffline, hp, damage, repair, mostDamaged,
  };
})(globalThis.Vide);
