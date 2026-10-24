// Le plan d'un village : un plan radial, comme les villes fortifiées en étoile. Autour du cœur, des boulevards
// en anneaux (tous les STREET) ; quatre avenues rayonnent du cœur vers quatre portes, orientées selon le village.
// Entre eux, les îlots : des emplacements à bâtir, à des positions fixes (un bâtiment posé sur le plan y reste
// quand le village grandit, et le plan d'un village ne change jamais).
// Chaque bâtiment a sa place selon son rôle (def.ring, en part du rayon du village : la vie et le savoir près du
// cœur, les logis autour, la production plus loin, la défense au bord) ; la défense se range près des avenues,
// donc des portes. Une cité garde le plan de son premier cœur ; ses anciens cœurs (quartiers) restent des places.
// Les bases des ombres suivent le même plan (leurs ouvrages : voir ouvrages.js).
(function (Vide) {
  'use strict';
  const { Territory } = Vide;

  const STREET = 110;   // écart entre deux boulevards (le premier îlot est à STREET / 2 du cœur)
  const AVENUES = 4;    // avenues, et portes de chaque enceinte
  const SPACING = 72;   // écart entre deux emplacements d'un même îlot (le long de l'anneau)
  const LANE = 30;      // aucun emplacement à moins de cette distance de l'axe d'une avenue
  const PLAZA = 70;     // autour d'un ancien cœur (quartier d'une cité), une place sans bâtiment

  // Ce qu'est un bâtiment posé : un bâtiment de village, ou un ouvrage d'une base des ombres (même plan).
  function defOf(type) {
    return (Vide.darkWork && Vide.darkWork(type)) || Vide.Structures.def(type);
  }

  // Orientation des avenues : propre à chaque village, toujours la même.
  function turn(v) {
    return ((Math.imul(v.id | 0, 0x9e3779b1) >>> 0) / 4294967296) * (Math.PI * 2 / AVENUES);
  }

  // Directions des avenues (et des portes), en radians.
  function avenues(v) {
    const a = turn(v);
    const list = [];
    for (let k = 0; k < AVENUES; k++) list.push(a + (k * Math.PI * 2) / AVENUES);
    return list;
  }

  // Écart angulaire (radians, 0 à π / AVENUES) entre une direction et l'avenue la plus proche.
  function offAvenue(v, angle) {
    const step = (Math.PI * 2) / AVENUES;
    let d = (angle - turn(v)) % step;
    if (d < 0) d += step;
    return Math.min(d, step - d);
  }

  // Avenue la plus proche d'une direction.
  function nearestAvenue(v, angle) {
    const step = (Math.PI * 2) / AVENUES;
    return turn(v) + Math.round((angle - turn(v)) / step) * step;
  }

  // Rayon de l'îlot n (entre les boulevards n et n + 1), et du boulevard n.
  const band = (n) => (n + 0.5) * STREET;
  const boulevard = (n) => n * STREET;

  // Emplacements de l'îlot n, relatifs au cœur : [{ dx, dy, r, a, n }] (purs : ne dépendent que de n et de
  // l'orientation du village). Dans chaque quart entre deux avenues, autant d'emplacements que la place le permet,
  // répartis au milieu.
  const bandCache = new Map();
  function bandSlots(v, n) {
    const t = turn(v);
    const key = `${n}:${t}`;
    let list = bandCache.get(key);
    if (list) return list;
    list = [];
    const r = band(n);
    const step = (Math.PI * 2) / AVENUES;
    const margin = LANE / r;
    const span = step - 2 * margin;
    const m = Math.max(1, Math.floor((span * r) / SPACING));
    for (let q = 0; q < AVENUES; q++) {
      for (let i = 0; i < m; i++) {
        const a = t + q * step + margin + (span * (i + 0.5)) / m;
        list.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, r, a, n });
      }
    }
    if (bandCache.size > 4000) bandCache.clear();
    bandCache.set(key, list);
    return list;
  }

  // Emplacements du plan qui tombent dans le territoire : [{ x, y, r, a, n }].
  function slots(v) {
    const list = [];
    const far = Territory.radius(v) * 1.6 + STREET;
    for (let n = 0; band(n) < far; n++) {
      for (const s of bandSlots(v, n)) {
        const x = v.x + s.dx, y = v.y + s.dy;
        if (Territory.contains(v, x, y)) list.push({ x, y, r: s.r, a: s.a, n });
      }
    }
    return list;
  }

  // L'emplacement est-il pris (un bâtiment dessus, ou la place d'un ancien cœur) ?
  function taken(v, x, y) {
    for (const b of v.buildings) if (Math.hypot(b.x - x, b.y - y) < SPACING * 0.6) return true;
    for (const d of v.districts || []) if (Math.hypot(d.x - x, d.y - y) < PLAZA) return true;
    return false;
  }

  // Emplacements libres du plan.
  function free(v) {
    return slots(v).filter((s) => !taken(v, s.x, s.y));
  }

  // Quart du village (entre deux avenues) où tombe une direction : 0 à AVENUES - 1.
  function quarter(v, angle) {
    const step = (Math.PI * 2) / AVENUES;
    let d = (angle - turn(v)) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    return Math.floor(d / step) % AVENUES;
  }

  // Prix d'un emplacement pour un bâtiment (plus bas = mieux) : l'écart à sa place idéale ; la défense attirée par
  // les avenues (les portes) et répartie de l'une à l'autre ; les quarts du village remplis à parts égales ; un
  // léger penchant à rejoindre sa famille (des quartiers).
  function score(v, d, s, R) {
    let cost = Math.abs(s.r / R - d.ring);
    const defense = d.family === 'defense';
    if (defense) cost += 0.3 * (offAvenue(v, s.a) * AVENUES) / Math.PI;
    const q = quarter(v, s.a);
    let family = false;
    for (const b of v.buildings) {
      const other = defOf(b.type);
      const near = Math.hypot(b.x - s.x, b.y - s.y);
      if (quarter(v, Math.atan2(b.y - v.y, b.x - v.x)) === q) cost += 0.025;
      if (defense && other.family === 'defense' && near < STREET * 2) cost += 0.12;
      if (!family && other.family === d.family && near < SPACING * 1.7) family = true;
    }
    return family ? cost - 0.03 : cost;
  }

  // Le meilleur emplacement libre pour un bâtiment de type `d`, ou null s'il n'y en a plus.
  function choose(v, d) {
    const R = Math.max(Territory.radius(v), STREET);
    let best = null;
    let bestCost = Infinity;
    for (const s of free(v)) {
      const cost = score(v, d, s, R);
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = s;
      }
    }
    return best;
  }

  // Range sur le plan les bâtiments d'un village bâti avant lui (dans l'ordre où ils ont été posés).
  // Une cité garde ses bâtiments où ils sont. Tout ou rien : sur une erreur, rien n'a bougé.
  function settle(v) {
    if ((v.districts || []).length) return;
    const placed = [];
    const ghost = { ...v, buildings: placed };
    const spots = v.buildings.map((b) => {
      const at = choose(ghost, defOf(b.type));
      placed.push({ type: b.type, x: at ? at.x : b.x, y: at ? at.y : b.y });
      return at;
    });
    v.buildings.forEach((b, i) => {
      if (spots[i]) {
        b.x = spots[i].x;
        b.y = spots[i].y;
      }
    });
  }

  Vide.Plan = {
    STREET, AVENUES, SPACING, LANE, PLAZA, turn, avenues, offAvenue, nearestAvenue, band, boulevard,
    quarter, slots, taken, free, choose, settle,
  };
})(globalThis.Vide);
