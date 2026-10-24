// Le jardin : la lumière qui naît d'elle-même dans le territoire. Les lueurs la récoltent ;
// le joueur peut aussi la ramasser en passant.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Field, Territory } = Vide;

  function create(seed) {
    // Même forme qu'un champ : Field.place et Field.attract s'y appliquent directement.
    return { particles: [], rng: util.rng(seed ^ 0x51ed27), budget: 0 };
  }

  function targetCount(state, stats) {
    if (!state.territory.lit) return 0;
    const g = CONFIG.garden;
    return Math.min(g.max, Math.round(g.density * state.territory.area * stats.gardenDensity));
  }

  function spawn(garden, state, visible) {
    const g = CONFIG.garden;
    const r = garden.rng;
    const radius = Territory.radius(state) * g.margin;
    if (radius <= g.foyerGap) return null;
    for (let tries = 0; tries < 10; tries++) {
      const angle = r() * Math.PI * 2;
      const dist = radius * Math.sqrt(r());
      if (dist < g.foyerGap) continue;
      const p = Field.place(garden, Math.cos(angle) * dist, Math.sin(angle) * dist, r() < g.rareChance, visible);
      p.vx *= 0.3; // le jardin est calme : presque aucune dérive
      p.vy *= 0.3;
      p.claimedBy = 0; // identifiant de la lueur qui la vise (0 : personne)
      return p;
    }
    return null;
  }

  function fill(garden, state, stats) {
    const target = targetCount(state, stats);
    for (let guard = 0; garden.particles.length < target && guard < target * 4; guard++) spawn(garden, state, true);
  }

  // Avance le jardin d'un pas ; renvoie ce que le joueur y a récolté lui-même.
  function update(garden, state, stats, dt) {
    const result = Field.attract(garden.particles, state.player, stats, dt, Infinity);
    const target = targetCount(state, stats);
    if (garden.particles.length < target) {
      garden.budget = Math.min(garden.budget + (target / CONFIG.garden.refillTime) * dt, 5);
      while (garden.budget >= 1 && garden.particles.length < target) {
        garden.budget--;
        spawn(garden, state, false);
      }
    } else {
      garden.budget = 0;
    }
    return result;
  }

  // Particule libre la plus proche (ni visée par une lueur, ni attirée par le joueur), ou null.
  function nearestFree(garden, x, y, maxDist) {
    let best = null;
    let bestD2 = maxDist * maxDist;
    for (const p of garden.particles) {
      if (p.claimedBy || p.caught >= 0) continue;
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
