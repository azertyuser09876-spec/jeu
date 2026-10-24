// Le jardin : la lumière qui naît d'elle-même dans le territoire de chaque village. Les lueurs du village
// la récoltent ; le joueur peut aussi la ramasser en passant.
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
    return Math.min(g.max, Math.round(g.density * village.area * stats.gardenDensity));
  }

  function spawn(garden, village, visible) {
    const g = CONFIG.garden;
    const r = garden.rng;
    const radius = Territory.radius(village) * g.margin;
    if (radius <= g.foyerGap) return null;
    for (let tries = 0; tries < 10; tries++) {
      const angle = r() * Math.PI * 2;
      const dist = radius * Math.sqrt(r());
      if (dist < g.foyerGap) continue;
      const x = village.x + Math.cos(angle) * dist, y = village.y + Math.sin(angle) * dist;
      const p = Field.place(garden, x, y, r() < g.rareChance, visible);
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
      const target = targetCount(v, Vide.Villages.statsOf(game, v));
      let have = n.get(v.id) || 0;
      for (let guard = 0; have < target && guard < target * 4; guard++) if (spawn(garden, v, true)) have++;
    }
  }

  // Avance le jardin d'un pas ; renvoie ce que le joueur y a récolté lui-même.
  function update(game, dt) {
    const { garden, state } = game;
    const result = Field.attract(garden.particles, state.player, game.stats, dt, Infinity);
    const n = counts(garden);
    for (const v of state.villages) {
      const target = targetCount(v, Vide.Villages.statsOf(game, v));
      let have = n.get(v.id) || 0;
      if (have >= target) {
        garden.budgets.set(v.id, 0);
        continue;
      }
      let budget = Math.min((garden.budgets.get(v.id) || 0) + (target / CONFIG.garden.refillTime) * dt, 5);
      while (budget >= 1 && have < target) {
        budget--;
        if (spawn(garden, v, false)) have++;
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

  Vide.Garden = { create, targetCount, spawn, fill, update, nearestFree, take };
})(globalThis.Vide);
