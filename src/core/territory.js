// Le territoire de chaque village : une étendue de lumière autour de son cœur, qui grandit lentement et rayonne.
//
// Sa surface (village.area) croît linéairement dans le temps : c'est elle qui compte pour l'économie.
// Sa forme est une grille de cellules (village.cells = [i, j, blanc, i, j, blanc, …], blanc de 0 à 100) :
// à mesure que la surface grandit, une cellule s'ajoute au bord, là où le village attire sa lumière
// (près du cœur, vers ses bâtiments, avec un peu d'irrégularité). Les cellules pleines blanchissent
// lentement depuis le cœur.
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  const CELL = CONFIG.territory.cell;
  const SPAN = 2097152; // clé numérique d'une cellule : i * SPAN + j (|j| < 2^20 cellules)
  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const key = (i, j) => i * SPAN + j;
  const cellOf = (x) => Math.floor(x / CELL);
  const center = (i) => (i + 0.5) * CELL;

  function radius(village) {
    return village ? Math.sqrt(village.area / Math.PI) : 0;
  }

  // Nombre de cellules qui correspond à la surface du village.
  function targetCells(village) {
    return Math.max(1, Math.round(village.area / (CELL * CELL)));
  }

  // --- Index des cellules (jamais sauvegardé, reconstruit au besoin) ---

  const indexes = new WeakMap();

  function index(v) {
    let idx = indexes.get(v);
    if (!idx || idx.cells !== v.cells || idx.length !== v.cells.length) {
      const map = new Map();
      for (let k = 0; k < v.cells.length; k += 3) map.set(key(v.cells[k], v.cells[k + 1]), k);
      idx = { map, cells: v.cells, length: v.cells.length, frontier: null, buildings: -1, clock: idx ? idx.clock : 0 };
      indexes.set(v, idx);
    }
    return idx;
  }

  function has(v, i, j) {
    return index(v).map.has(key(i, j));
  }

  // Blancheur (0 à 1) de la cellule (i, j) du village, ou -1 si elle n'en fait pas partie.
  function whiteOf(v, i, j) {
    const k = index(v).map.get(key(i, j));
    return k === undefined ? -1 : v.cells[k + 2] / 100;
  }

  // Le point (x, y) est-il dans le territoire du village, à `margin` près (arrondi à une cellule) ?
  function contains(village, x, y, margin) {
    const { map } = index(village);
    const ci = cellOf(x), cj = cellOf(y);
    if (map.has(key(ci, cj))) return true;
    const reach = Math.ceil((margin || 0) / CELL);
    for (let di = -reach; di <= reach; di++) {
      for (let dj = -reach; dj <= reach; dj++) if (map.has(key(ci + di, cj + dj))) return true;
    }
    return false;
  }

  // Le point (x, y) est-il dans le territoire d'un village ?
  function isInside(state, x, y) {
    return state.villages.some((v) => contains(v, x, y));
  }

  // Blancheur de la lumière en (x, y) (0 hors de tout territoire).
  function whiteAt(state, x, y) {
    let w = 0;
    for (const v of state.villages) w = Math.max(w, whiteOf(v, cellOf(x), cellOf(y)));
    return w;
  }

  // Distance de (x, y) au bord du territoire le plus proche (négative à l'intérieur), Infinity sans village.
  // Approchée par le rayon équivalent : suffisant pour savoir si l'on est loin de tout.
  function distanceToEdge(state, x, y) {
    let best = Infinity;
    for (const v of state.villages) best = Math.min(best, Math.hypot(v.x - x, v.y - y) - radius(v));
    return best;
  }

  // --- Croissance de la forme ---

  // Bruit doux (de 0 à 1) : tiré sur une grille grossière de 5 cellules, puis interpolé. Donne de grandes
  // ondulations plutôt qu'un bord hérissé.
  function smoothNoise(i, j, seed) {
    const S = 5;
    const gi = Math.floor(i / S), gj = Math.floor(j / S);
    const fi = i / S - gi, fj = j / S - gj;
    const sx = fi * fi * (3 - 2 * fi), sy = fj * fj * (3 - 2 * fj);
    const h = (a, b) => util.hash2(a, b, seed);
    const top = h(gi, gj) + (h(gi + 1, gj) - h(gi, gj)) * sx;
    const bottom = h(gi, gj + 1) + (h(gi + 1, gj + 1) - h(gi, gj + 1)) * sx;
    return top + (bottom - top) * sy;
  }

  const seedOf = (v, salt) => Math.imul(v.id, 0x9e3779b1) ^ salt;

  // Attrait propre d'une cellule du bord : irrégularité (surtout de grandes ondulations), bâtiments
  // (chantiers compris).
  function appeal(v, i, j) {
    const t = CONFIG.territory;
    let score = t.noise * (0.8 * smoothNoise(i, j, seedOf(v, 0)) + 0.2 * util.hash2(i, j, seedOf(v, 1)));
    const x = center(i), y = center(j);
    for (const b of v.buildings) score += t.pull * Math.exp(-Math.hypot(b.x - x, b.y - y) / t.pullRange);
    return score;
  }

  function addFrontier(v, idx, i, j) {
    const k = key(i, j);
    if (idx.map.has(k) || idx.frontier.has(k)) return;
    idx.frontier.set(k, { i, j, appeal: appeal(v, i, j) });
  }

  function addCell(v, idx, i, j) {
    const k = key(i, j);
    idx.map.set(k, v.cells.length);
    v.cells.push(i, j, 0);
    idx.length = v.cells.length;
    if (idx.frontier) {
      idx.frontier.delete(k);
      for (const [di, dj] of NEIGHBORS) addFrontier(v, idx, i + di, j + dj);
    }
  }

  // Ajoute les cellules qui manquent pour que la forme corresponde à la surface. Renvoie le nombre ajouté.
  function grow(v) {
    const idx = index(v);
    const target = targetCells(v);
    if (v.cells.length / 3 >= target) return 0;
    if (!v.cells.length) addCell(v, idx, cellOf(v.x), cellOf(v.y));
    // Le bord (et l'attrait de chacune de ses cellules) se recalcule quand les bâtiments changent.
    if (!idx.frontier || idx.buildings !== v.buildings.length) {
      idx.frontier = new Map();
      idx.buildings = v.buildings.length;
      for (let k = 0; k < v.cells.length; k += 3) {
        for (const [di, dj] of NEIGHBORS) addFrontier(v, idx, v.cells[k] + di, v.cells[k + 1] + dj);
      }
    }
    let added = 0;
    while (v.cells.length / 3 < target) {
      // La cellule du bord la plus attirante : proche du cœur (relativement à la taille), près des bâtiments.
      const R = Math.max(CELL, radius(v));
      let best = null;
      let bestScore = -Infinity;
      for (const c of idx.frontier.values()) {
        const score = c.appeal - Math.hypot(center(c.i) - v.x, center(c.j) - v.y) / R;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      addCell(v, idx, best.i, best.j);
      added++;
    }
    return added;
  }

  // --- Blanc ---

  function interior(v, i, j) {
    for (const [di, dj] of NEIGHBORS) if (!has(v, i + di, j + dj)) return false;
    return true;
  }

  function touchesWhite(v, i, j) {
    for (const [di, dj] of NEIGHBORS) if (whiteOf(v, i + di, j + dj) >= 1) return true;
    return false;
  }

  // Un pas de blanchiment de `step` % : les cellules qui blanchissent déjà continuent ; une cellule intérieure,
  // assez proche du cœur et voisine d'une cellule toute blanche (ou le cœur lui-même), commence.
  function whitenStep(v, step) {
    const reach = radius(v) * CONFIG.territory.whiteReach;
    const hi = cellOf(v.x), hj = cellOf(v.y);
    const cells = v.cells;
    const growing = [];
    for (let k = 0; k < cells.length; k += 3) {
      const w = cells[k + 2];
      if (w >= 100) continue;
      if (w === 0) {
        const i = cells[k], j = cells[k + 1];
        const heart = i === hi && j === hj;
        if (!heart) {
          // Tests du moins coûteux au plus coûteux : distance, voisines, puis la limite du blanc, qui ondule.
          const d = Math.hypot(center(i) - v.x, center(j) - v.y);
          if (d > reach * 1.2 || !touchesWhite(v, i, j) || !interior(v, i, j)) continue;
          if (d > reach * (0.8 + 0.4 * smoothNoise(i, j, seedOf(v, 2)))) continue;
        } else if (!interior(v, i, j)) {
          continue;
        }
      }
      growing.push(k);
    }
    for (const k of growing) cells[k + 2] = Math.min(100, cells[k + 2] + step);
  }

  // Fait avancer le blanc d'un village de `seconds` secondes (par pas de 1 %, ou de 10 % pour une longue absence).
  function whiten(v, stats, seconds) {
    const idx = index(v);
    idx.clock += (seconds * 100 * (stats.whitening || 1)) / CONFIG.territory.whiteTime;
    while (idx.clock >= 1) {
      const step = Math.min(10, Math.floor(idx.clock));
      idx.clock -= step;
      whitenStep(v, step);
    }
  }

  // Part blanche du territoire (0 à 1).
  function whiteness(v) {
    let sum = 0;
    for (let k = 2; k < v.cells.length; k += 3) sum += v.cells[k];
    return v.cells.length ? sum / (100 * (v.cells.length / 3)) : 0;
  }

  // Point au hasard dans le territoire (uniforme sur la surface) : une cellule, puis un point dans la cellule.
  function randomPoint(v, rng) {
    const n = v.cells.length / 3;
    if (!n) return { x: v.x, y: v.y, white: 0 };
    const k = 3 * Math.min(n - 1, Math.floor(rng() * n));
    return { x: (v.cells[k] + rng()) * CELL, y: (v.cells[k + 1] + rng()) * CELL, white: v.cells[k + 2] / 100 };
  }

  // --- Contour ---

  // Contour des cellules d'un village (celles dont le blanc atteint `minWhite` %, toutes par défaut) :
  // des boucles fermées de points [x, y] dans le monde, sans les points alignés.
  function outline(v, minWhite) {
    const min = minWhite || 0;
    const inside = (i, j) => {
      const k = index(v).map.get(key(i, j));
      return k !== undefined && v.cells[k + 2] >= min;
    };
    // Arêtes orientées le long du bord (le territoire toujours du même côté), indexées par leur départ.
    const edges = new Map();
    const push = (x0, y0, x1, y1) => {
      const k = key(x0, y0);
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k).push([x0, y0, x1, y1]);
    };
    for (let k = 0; k < v.cells.length; k += 3) {
      const i = v.cells[k], j = v.cells[k + 1];
      if (!inside(i, j)) continue;
      if (!inside(i, j - 1)) push(i + 1, j, i, j);
      if (!inside(i - 1, j)) push(i, j, i, j + 1);
      if (!inside(i, j + 1)) push(i, j + 1, i + 1, j + 1);
      if (!inside(i + 1, j)) push(i + 1, j + 1, i + 1, j);
    }
    const loops = [];
    for (const list of edges.values()) {
      while (list.length) {
        const first = list.pop();
        const loop = [[first[0], first[1]]];
        let [, , x, y] = first;
        for (let guard = 0; guard < 1e6; guard++) {
          const next = edges.get(key(x, y));
          if (!next || !next.length) break;
          const e = next.pop();
          loop.push([e[0], e[1]]);
          [, , x, y] = e;
        }
        // Retire les points au milieu d'une ligne droite, puis passe en coordonnées du monde.
        const n = loop.length;
        const simple = loop.filter((p, idx) => {
          const a = loop[(idx + n - 1) % n], b = loop[(idx + 1) % n];
          return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
        });
        if (simple.length >= 3) loops.push(simple.map(([gx, gy]) => [gx * CELL, gy * CELL]));
      }
    }
    return loops;
  }

  // --- Économie ---

  // Fait avancer le territoire d'un village de `seconds` secondes. Formule exacte (surface linéaire dans le temps),
  // donc identique qu'on l'appelle une fois pour 3 heures ou 648 000 fois pour 1/60 s.
  // Met à jour la surface (et la forme) et renvoie la lumière produite (à créditer par l'appelant).
  // `stats` : caractéristiques du village (voir Villages.local).
  function advance(village, stats, seconds) {
    if (seconds <= 0) return 0;
    const a0 = village.area;
    const g = stats.territoryGrowth;
    village.area = a0 + g * seconds;
    grow(village);
    return stats.territoryYield * (a0 * seconds + (g * seconds * seconds) / 2);
  }

  // Lumière par seconde produite actuellement par un village.
  function production(village, stats) {
    return village.area * stats.territoryYield;
  }

  Vide.Territory = {
    CELL, cellOf, radius, targetCells, has, whiteOf, contains, isInside, whiteAt, distanceToEdge,
    grow, whiten, whiteness, randomPoint, outline, advance, production,
  };
})(globalThis.Vide);
