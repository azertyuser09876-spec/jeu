// Le territoire de chaque village : une étendue de lumière autour de son cœur, qui grandit lentement et rayonne.
//
// Sa surface (village.area) croît linéairement dans le temps : c'est elle qui compte pour l'économie.
// Sa forme est une grille de cellules (village.cells = [i, j, blanc, i, j, blanc, …], blanc de 0 à 100) :
// à mesure que la surface grandit, une cellule s'ajoute au bord, là où le village attire sa lumière
// (près du cœur, vers ses bâtiments, avec un peu d'irrégularité). Les cellules pleines blanchissent
// lentement depuis le cœur, en cinq nuances (voir NUANCES) jusqu'au blanc pur ; chaque nuance est plus lente à
// gagner que la précédente, et une cellule plus blanche tient mieux (voir HOLD : elle est plus dure à perdre).
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
      idx = {
        map, cells: v.cells, length: v.cells.length, frontier: null, buildings: -1,
        clock: idx ? idx.clock : 0, carry: idx ? idx.carry : null,
      };
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

  const ROUND = { metric: 'round', lobes: 0, depth: 0, sharp: 1, noise: 1 };

  function shapeOf(v) {
    const type = Vide.VILLAGE_TYPES && Vide.VILLAGE_TYPES.find((t) => t.id === v.type);
    return (type && type.shape) || ROUND;
  }

  // Éloignement d'une cellule au cœur, selon la silhouette du village : le territoire pousse d'abord là où
  // cette mesure est la plus petite (un carré pour l'atelier, des pétales pour les jardins…).
  function reachOf(v, shape, i, j) {
    const dx = Math.abs(center(i) - v.x), dy = Math.abs(center(j) - v.y);
    let d = Math.hypot(dx, dy);
    if (shape.metric === 'square') d = Math.max(dx, dy) * 1.13;
    else if (shape.metric === 'octagon') d = Math.max(dx, dy, (dx + dy) * Math.SQRT1_2) * 1.05;
    if (shape.lobes) {
      const a = Math.atan2(center(j) - v.y, center(i) - v.x) + v.id; // orientation propre à chaque village
      d *= 1 - shape.depth * Math.pow(Math.max(0, Math.cos(shape.lobes * a)), shape.sharp);
    }
    return d;
  }

  // Attrait propre d'une cellule du bord : irrégularité (surtout de grandes ondulations), bâtiments
  // (chantiers compris).
  function appeal(v, i, j) {
    const t = CONFIG.territory;
    // Une cité a des contours plus nets.
    const noise = t.noise * shapeOf(v).noise * (v.extra && v.extra.length ? 0.5 : 1);
    let score = noise * (0.8 * smoothNoise(i, j, seedOf(v, 0)) + 0.2 * util.hash2(i, j, seedOf(v, 1)));
    const x = center(i), y = center(j);
    for (const b of v.buildings) score += t.pull * Math.exp(-Math.hypot(b.x - x, b.y - y) / t.pullRange);
    return score;
  }

  function addFrontier(v, idx, i, j) {
    const k = key(i, j);
    if (idx.map.has(k) || idx.frontier.has(k)) return;
    idx.frontier.set(k, { i, j, appeal: appeal(v, i, j), reach: reachOf(v, shapeOf(v), i, j) });
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
        const score = c.appeal - c.reach / R;
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

  // Les cinq nuances du blanc : seuil (en %) de chacune ; la cinquième est le blanc pur.
  const NUANCES = [1, 25, 50, 75, 100];
  // Lenteur de chaque nuance : une cellule de la nuance n avance SLOW[n] fois moins vite.
  const SLOW = [1, 1, 2, 5, 12];
  // Tenue d'une cellule selon sa nuance (0 : pas encore blanche) : l'effort qu'il faut pour la prendre.
  const HOLD = [1, 1.5, 2.5, 4, 7, 12];
  // Une cellule commence à blanchir quand une voisine a atteint ce blanc (%).
  const SPREAD = 25;
  // Le blanc le plus avancé qu'une cellule peut atteindre selon sa distance au cœur (en part de la portée du
  // blanc) : le blanc pur au centre, puis des anneaux de moins en moins blancs jusqu'au bord.
  const RINGS = [[0.35, 100], [0.55, 99], [0.75, 74], [0.9, 49], [Infinity, 24]];

  function ceilingAt(f) {
    for (const [limit, w] of RINGS) if (f < limit) return w;
    return 24;
  }

  // Nuance d'un blanc (0 à 100) : 0 (pas blanche) à 5 (blanc pur).
  function nuance(w) {
    let n = 0;
    while (n < NUANCES.length && w >= NUANCES[n]) n++;
    return n;
  }

  // Tenue de la cellule (i, j) d'un village (1 hors du blanc, jusqu'à HOLD[5] dans le blanc pur).
  function hold(v, i, j) {
    const w = whiteOf(v, i, j);
    return w < 0 ? 0 : HOLD[nuance(Math.round(w * 100))];
  }

  function interior(v, i, j) {
    for (const [di, dj] of NEIGHBORS) if (!has(v, i + di, j + dj)) return false;
    return true;
  }

  function touchesWhite(v, i, j) {
    for (const [di, dj] of NEIGHBORS) if (whiteOf(v, i + di, j + dj) >= SPREAD / 100) return true;
    return false;
  }

  // Un pas de blanchiment de `step` % : les cellules qui blanchissent déjà continuent (chacune au rythme de sa
  // nuance) ; une cellule intérieure, assez proche du cœur et voisine d'une cellule déjà blanche (ou le cœur
  // lui-même), commence.
  function whitenStep(v, step, idx) {
    const reach = radius(v) * CONFIG.territory.whiteReach;
    const hi = cellOf(v.x), hj = cellOf(v.y);
    const cells = v.cells;
    // Ce que gagne, à ce pas, une cellule de chaque nuance (le reste fractionnaire est reporté).
    const carry = idx.carry || (idx.carry = [0, 0, 0, 0, 0]);
    const gain = carry.map((c, n) => {
      const total = c + step / SLOW[n];
      const whole = Math.floor(total);
      carry[n] = total - whole;
      return whole;
    });
    const growing = [];
    const ceilings = [];
    for (let k = 0; k < cells.length; k += 3) {
      const w = cells[k + 2];
      if (w >= 100 || !gain[nuance(w)]) continue;
      const i = cells[k], j = cells[k + 1];
      const heart = i === hi && j === hj;
      const d = heart ? 0 : Math.hypot(center(i) - v.x, center(j) - v.y);
      const ceiling = heart ? 100 : ceilingAt(d / Math.max(reach, CELL));
      if (w >= ceiling) continue;
      if (w === 0) {
        if (!heart) {
          // Tests du moins coûteux au plus coûteux : distance, voisines, puis la limite du blanc, qui ondule.
          if (d > reach * 1.2 || !touchesWhite(v, i, j) || !interior(v, i, j)) continue;
          if (d > reach * (0.8 + 0.4 * smoothNoise(i, j, seedOf(v, 2)))) continue;
        } else if (!interior(v, i, j)) {
          continue;
        }
      }
      growing.push(k);
      ceilings.push(ceiling);
    }
    growing.forEach((k, n) => {
      cells[k + 2] = Math.min(ceilings[n], cells[k + 2] + gain[nuance(cells[k + 2])]);
    });
  }

  // Fait avancer le blanc d'un village de `seconds` secondes (par pas de 1 %, ou de 10 % pour une longue absence).
  function whiten(v, stats, seconds) {
    const idx = index(v);
    idx.clock += (seconds * 100 * (stats.whitening || 1)) / CONFIG.territory.whiteTime;
    while (idx.clock >= 1) {
      const step = Math.min(10, Math.floor(idx.clock));
      idx.clock -= step;
      whitenStep(v, step, idx);
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
    CELL, NUANCES, HOLD, cellOf, radius, targetCells, has, whiteOf, contains, isInside, whiteAt, distanceToEdge,
    nuance, hold, grow, whiten, whiteness, randomPoint, outline, advance, production,
  };
})(globalThis.Vide);
