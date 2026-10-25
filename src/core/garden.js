// Le jardin : la lumière qui naît d'elle-même dans le territoire de chaque village, à portée de ses foyers (son
// cœur, les anciens cœurs d'une cité, ses relais) : un territoire immense ne l'éparpille pas hors d'atteinte. Les
// lueurs du village la récoltent ; le joueur peut aussi la ramasser en passant.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Field, Territory } = Vide;

  function create(seed) {
    // Même forme qu'un champ : Field.place et Field.attract s'y appliquent directement.
    // Chaque particule porte le numéro de son village.
    return { particles: [], rng: util.rng(seed ^ 0x51ed27), budgets: new Map() };
  }

  // Nombre de particules visé pour un village (selon sa surface et ses caractéristiques locales).
  function targetCount(village, stats) {
    const g = CONFIG.garden;
    return Math.min(stats.gardenMax || g.max, Math.round(g.density * village.area * stats.gardenDensity));
  }

  // Les foyers d'un village, où ses lueurs rapportent la lumière : son cœur, ses anciens cœurs, ses relais achevés.
  function hearths(village) {
    const list = [{ x: village.x, y: village.y }, ...(village.districts || [])];
    for (const b of village.buildings) if (Vide.Structures.def(b.type).deposit && Vide.Structures.isWorking(b)) list.push(b);
    return list;
  }

  const near = (list, x, y, r) => list.some((h) => (h.x - x) ** 2 + (h.y - y) ** 2 <= r * r);

  // Une particule naît en un point du territoire à portée d'un foyer (`homes`), jamais collée au cœur. La lumière
  // dorée est plus fréquente là où le territoire a blanchi. Null si elle n'a pas trouvé sa place (elle réessaiera).
  function spawn(garden, village, visible, rareMult, homes) {
    const g = CONFIG.garden;
    const r = garden.rng;
    if (Territory.radius(village) <= g.foyerGap) return null;
    const list = homes || hearths(village);
    for (let tries = 0; tries < 30; tries++) {
      const at = Territory.randomPoint(village, r);
      if (Math.hypot(at.x - village.x, at.y - village.y) < g.foyerGap) continue;
      if (!near(list, at.x, at.y, g.reach)) continue;
      const chance = g.rareChance * (rareMult || 1) * (1 + (CONFIG.territory.whiteRare - 1) * at.white);
      const rare = r() < Math.min(0.5, chance); // jamais plus d'une particule dorée sur deux
      const p = Field.place(garden, at.x, at.y, rare, visible);
      p.vx *= 0.3; // le jardin est calme : presque aucune dérive
      p.vy *= 0.3;
      p.claimedBy = 0; // identifiant de la lueur qui la vise (0 : personne)
      p.village = village.id;
      return p;
    }
    return null;
  }

  function counts(garden) {
    const n = new Map();
    for (const p of garden.particles) n.set(p.village, (n.get(p.village) || 0) + 1);
    return n;
  }

  // Remplit d'un coup le jardin de chaque village (au chargement).
  function fill(game) {
    const { garden } = game;
    const n = counts(garden);
    for (const v of game.state.villages) {
      const stats = Vide.Villages.statsOf(game, v);
      const target = targetCount(v, stats);
      const homes = hearths(v);
      let have = n.get(v.id) || 0;
      for (let guard = 0; have < target && guard < target * 4; guard++) if (spawn(garden, v, true, stats.gardenRare, homes)) have++;
    }
  }

  // Avance le jardin d'un pas ; renvoie ce que le joueur y a récolté lui-même.
  function update(game, dt) {
    const { garden, state } = game;
    const result = Field.attract(garden.particles, state.player, game.stats, dt, Infinity);
    const n = counts(garden);
    for (const v of state.villages) {
      const stats = Vide.Villages.statsOf(game, v);
      const target = targetCount(v, stats);
      let have = n.get(v.id) || 0;
      if (have >= target) {
        garden.budgets.set(v.id, 0);
        continue;
      }
      let budget = Math.min((garden.budgets.get(v.id) || 0) + (target / CONFIG.garden.refillTime) * dt, 5);
      const homes = budget >= 1 ? hearths(v) : null;
      while (budget >= 1 && have < target) {
        budget--;
        if (spawn(garden, v, false, stats.gardenRare, homes)) have++;
      }
      garden.budgets.set(v.id, budget);
    }
    return result;
  }

  // Particule libre la plus proche (ni visée par une lueur, ni attirée par le joueur) d'un village, ou null.
  function nearestFree(garden, x, y, maxDist, villageId) {
    let best = null;
    let bestD2 = maxDist * maxDist;
    for (const p of garden.particles) {
      if (p.claimedBy || p.caught >= 0 || p.village !== villageId) continue;
      const dx = p.x - x, dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = p;
      }
    }
    return best;
  }

  // Retire une particule ramassée par une lueur.
  function take(garden, p) {
    const i = garden.particles.indexOf(p);
    if (i < 0) return false;
    p.gone = true;
    Field.removeAt(garden.particles, i);
    return true;
  }

  Vide.Garden = { create, targetCount, hearths, spawn, fill, update, nearestFree, take };
})(globalThis.Vide);
