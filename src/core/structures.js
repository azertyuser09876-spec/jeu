// Bâtiments des villages : planification, emplacement, construction, effets.
// État persistant : village.buildings = [{ type, x, y, work }] ; un bâtiment est achevé quand work ≥ def.work.
(function (Vide) {
  'use strict';
  const { util, Catalog, Territory, Villages } = Vide;

  const MIN_TERRITORY = 80; // rayon minimal pour bâtir

  function def(type) {
    const d = Vide.BUILDINGS.find((b) => b.id === type);
    if (!d) throw new Error(`Bâtiment inconnu : ${type}`);
    return d;
  }

  function isDone(building) {
    return building.work >= def(building.type).work;
  }

  // Nombre de bâtiments d'un type dans un village (achevés seulement, ou tous en comptant les chantiers).
  function countIn(village, type, includeSites) {
    let n = 0;
    for (const b of village.buildings) if (b.type === type && (includeSites || isDone(b))) n++;
    return n;
  }

  // … et dans tous les villages (le prix d'un plan en dépend).
  function count(state, type, includeSites) {
    let n = 0;
    for (const v of state.villages) n += countIn(v, type, includeSites);
    return n;
  }

  // Tous les bâtiments, tous villages confondus.
  function all(state) {
    const list = [];
    for (const v of state.villages) list.push(...v.buildings);
    return list;
  }

  // Bâtiments d'un type qui fonctionnent dans un village (achevés et non éteints).
  function working(village, type) {
    let n = 0;
    for (const b of village.buildings) if (b.type === type && isWorking(b)) n++;
    return n;
  }

  function sites(village) {
    return village.buildings.filter((b) => !isDone(b));
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

  // Bâtiment achevé le plus abîmé d'un village (les éteints d'abord, puis le plus proche), ou null.
  function mostDamaged(game, village, x, y) {
    let best = null;
    let bestScore = Infinity;
    for (const b of village.buildings) {
      if (!isDone(b) || hp(game, b) >= def(b.type).hp) continue;
      const score = (b.broken ? 0 : 1e9) + Math.hypot(b.x - x, b.y - y);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  // Choisit un emplacement : à la distance voulue du cœur du village, le plus loin possible des autres bâtiments.
  // Déterministe : un même état donne toujours le même emplacement.
  function site(state, village, d) {
    const radius = Territory.radius(village);
    const dist = util.clamp(d.ring * radius, 50, radius * 0.9);
    const rng = util.rng(state.seed ^ Math.imul(village.buildings.length + 1, 0x9e3779b1) ^ Math.imul(village.id, 0x85ebca6b));
    const start = rng() * Math.PI * 2;
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < 24; i++) {
      const a = start + (i / 24) * Math.PI * 2;
      const x = village.x + Math.cos(a) * dist, y = village.y + Math.sin(a) * dist;
      let score = Infinity;
      for (const b of village.buildings) score = Math.min(score, Math.hypot(b.x - x, b.y - y));
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }

  function plan(state, village, type) {
    const d = def(type);
    const at = site(state, village, d);
    const building = { type, x: at.x, y: at.y, work: 0 };
    village.buildings.push(building);
    return building;
  }

  // Ajoute du travail à un chantier ; renvoie vrai s'il vient d'être achevé.
  function addWork(building, amount) {
    if (isDone(building)) return false;
    building.work = Math.min(def(building.type).work, building.work + amount);
    return isDone(building);
  }

  function nearestSite(village, x, y) {
    let best = null;
    let bestD2 = Infinity;
    for (const b of village.buildings) {
      if (isDone(b)) continue;
      const d2 = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
    }
    return best;
  }

  // Point de dépôt le plus proche pour une lueur : le cœur de son village, ou un relais (prisme) achevé.
  function nearestDeposit(village, x, y) {
    let best = { x: village.x, y: village.y, mult: 1, building: null };
    let bestD2 = (village.x - x) ** 2 + (village.y - y) ** 2;
    for (const b of village.buildings) {
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

  // Effets des bâtiments achevés d'un village sur ses caractéristiques (appelé par Villages.local).
  function modify(village, stats) {
    for (const d of Vide.BUILDINGS) {
      if (!d.modify || d.scope === 'global') continue;
      const n = working(village, d.id);
      if (n > 0) d.modify(stats, n);
    }
  }

  // Effets des bâtiments dont la portée est globale (Archive, Fonderie, Lunette…), tous villages confondus
  // (appelé par Stats.compute).
  function modifyGlobal(state, stats) {
    for (const d of Vide.BUILDINGS) {
      if (!d.modify || d.scope !== 'global') continue;
      let n = 0;
      for (const v of state.villages) n += working(v, d.id);
      if (n > 0) d.modify(stats, n);
    }
  }

  // Ralentissement des ombres en (x, y) par les remparts (1 : aucun).
  function wardAt(state, x, y) {
    let slow = 1;
    for (const v of state.villages) {
      for (const b of v.buildings) {
        const ward = def(b.type).ward;
        if (ward && isWorking(b) && Math.hypot(b.x - x, b.y - y) <= ward.radius) slow = Math.min(slow, ward.slow);
      }
    }
    return slow;
  }

  // Pendant l'absence, les bâtisseurs d'un village continuent ses chantiers dans l'ordre.
  // Renvoie les bâtiments achevés. `stats` : caractéristiques du village.
  function advanceOffline(village, stats, seconds) {
    const builders = village.beings.batisseur || 0;
    let budget = builders * stats.buildRate * seconds;
    const done = [];
    for (const b of village.buildings) {
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
    // « propre aux ateliers », « propre aux jardins »…
    const onlyName = d.only ? Villages.type(d.only).name.toLowerCase().replace(/([^s])$/, '$1s') : null;
    Catalog.register({
      id: d.id,
      tab: 'batiments',
      // Rangés par famille : économie, vie, savoir, défense.
      order: Vide.BUILDING_FAMILIES.indexOf(d.family),
      name: d.name,
      desc: d.desc,
      revealed: (state) => count(state, d.id, true) > 0 ||
        (Villages.count(state, 'lueur') > 0 && (!d.requires || d.requires(state)) &&
          (!d.only || state.villages.some((v) => v.type === d.only)) && state.totalLight >= d.baseCost * 0.4),
      cost: (state) => cost(state, d),
      // Un plan se pose dans le village où l'on se trouve.
      blocked: (state) => {
        const village = Villages.current(state);
        if (!village) return 'rejoins un village';
        if (d.only && village.type !== d.only) return `propre aux ${onlyName}`;
        if (!(village.beings.batisseur > 0)) return 'il faut un bâtisseur';
        if (Territory.radius(village) < MIN_TERRITORY) return 'territoire trop petit';
        return null;
      },
      apply: (state) => { plan(state, Villages.current(state), d.id); },
      label: (state) => {
        const village = Villages.current(state);
        const built = village ? countIn(village, d.id, false) : count(state, d.id, false);
        const pending = (village ? countIn(village, d.id, true) : count(state, d.id, true)) - built;
        return pending ? `×${built} · ${pending} en chantier` : `×${built}`;
      },
      effect: () => d.effectText,
    });
  }

  Vide.Structures = {
    def, isDone, isWorking, count, countIn, all, working, sites, cost, site, plan, addWork, nearestSite, nearestDeposit,
    modify, modifyGlobal, wardAt, advanceOffline, hp, damage, repair, mostDamaged, MIN_TERRITORY,
  };
})(globalThis.Vide);
