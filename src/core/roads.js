// Routes de lumière entre villages. On en planifie une depuis un village, vers le plus proche qui ne lui est pas
// encore relié ; les bâtisseurs des deux bouts la construisent, chacun depuis son cœur.
// État persistant : state.roads = [{ a, b, work }] (numéros des villages, a < b ; work : longueur déjà bâtie,
// comptée sur la distance entre les deux cœurs).
// Son tracé (route) : de chaque cœur, l'avenue la mieux tournée vers l'autre village jusqu'à sa sortie (passé son
// enceinte, au bord du territoire) ; entre les deux sorties, une grande route qui part dans l'axe de chaque avenue,
// ondule à peine (chaque route a son dessin) et contourne les villages sur son chemin. Les routes qui sortent par
// la même porte partagent un tronc, puis se séparent à un carrefour (voir network).
// Sur une route achevée, la lumière du joueur file plus vite ; les caravanes la suivent (voir trade.js).
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Villages, Plan, Territory } = Vide;

  // --- Le réseau des grandes routes ---

  // La porte (le numéro de l'avenue) par laquelle un village sort vers un point.
  function gateIndex(v, toward) {
    const step = (Math.PI * 2) / Plan.AVENUES;
    const k = Math.round((Math.atan2(toward.y - v.y, toward.x - v.x) - Plan.turn(v)) / step);
    return ((k % Plan.AVENUES) + Plan.AVENUES) % Plan.AVENUES;
  }

  // Sortie d'un village par l'avenue k : passé son enceinte, au bord de son territoire.
  function exitAt(v, k) {
    const a = Plan.turn(v) + (k * Math.PI * 2) / Plan.AVENUES;
    const walls = v.walls || [];
    const outer = walls.length ? Vide.Walls.radius(walls[walls.length - 1]) + 50 : 0;
    const r = Math.max(outer, Territory.radius(v) * 0.9);
    return { x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r, ux: Math.cos(a), uy: Math.sin(a) };
  }

  // Sortie d'un village vers un autre : au bout de l'avenue la mieux tournée.
  function exit(v, toward) {
    const e = exitAt(v, gateIndex(v, toward));
    return { x: e.x, y: e.y };
  }

  // La grande route entre deux points S et T, qu'elle quitte dans les directions us et ut : une courbe de Bézier,
  // quelques méandres doux (propres à chaque route, nuls aux deux bouts), et un détour autour des autres villages.
  function bend(state, a, b, S, us, T, ut) {
    const chord = Math.hypot(T.x - S.x, T.y - S.y) || 1;
    const k = chord * 0.35;
    const P1 = { x: S.x + us.x * k, y: S.y + us.y * k }, P2 = { x: T.x + ut.x * k, y: T.y + ut.y * k };
    const seed = Math.imul(a.id, 0x9e3779b1) ^ Math.imul(b.id, 0x85ebca6b);
    const phase = ((seed >>> 0) / 4294967296) * Math.PI * 2;
    const amp = Math.min(70, chord * 0.03) * (((seed >>> 8) & 1) ? 1 : -1);
    const nx = -(T.y - S.y) / chord, ny = (T.x - S.x) / chord;
    const n = Math.max(8, Math.min(60, Math.round(chord / 70)));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * u * S.x + 3 * u * u * t * P1.x + 3 * u * t * t * P2.x + t * t * t * T.x;
      const y = u * u * u * S.y + 3 * u * u * t * P1.y + 3 * u * t * t * P2.y + t * t * t * T.y;
      const off = amp * Math.sin(Math.PI * t) * Math.sin(Math.PI * 2 * t + phase);
      pts.push({ x: x + nx * off, y: y + ny * off });
    }
    // Le détour autour des autres villages (trois passes, adoucies), sans toucher aux deux bouts.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < pts.length - 1; i++) {
        for (const o of state.villages) {
          if (o === a || o === b) continue;
          const clear = Territory.radius(o) + 120;
          const dx = pts[i].x - o.x, dy = pts[i].y - o.y;
          const d = Math.hypot(dx, dy);
          if (d < clear) {
            const ux = d > 0 ? dx / d : nx, uy = d > 0 ? dy / d : ny;
            pts[i] = { x: o.x + ux * clear, y: o.y + uy * clear };
          }
        }
      }
      if (pass < 2) {
        for (let i = 1; i < pts.length - 1; i++) {
          pts[i] = { x: (pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) / 4, y: (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4 };
        }
      }
    }
    return pts;
  }

  // Le réseau : les routes qui quittent un village par la même porte en sortent ensemble — un tronc commun, plus
  // large, dans l'axe de l'avenue, jusqu'à un carrefour d'où chacune part de son côté.
  // { paths: Map('a>b' → [cœur, sortie, (carrefour), …, (carrefour), sortie, cœur]), trunks: [{ points, roads }] },
  // recalculé quand une route, un village, son rayon ou ses enceintes changent.
  const caches = new WeakMap();
  function network(state) {
    let sig = '';
    for (const r of state.roads) sig += `${r.a}-${r.b};`;
    for (const v of state.villages) sig += `${v.id}:${v.x},${v.y},${Math.round(Territory.radius(v) / 4)},${(v.walls || []).length};`;
    const known = caches.get(state);
    if (known && known.sig === sig) return known;

    const groups = new Map();
    for (const road of state.roads) {
      const [a, b] = ends(state, road);
      if (!a || !b) continue;
      for (const [v, o] of [[a, b], [b, a]]) {
        const k = gateIndex(v, o);
        const key = `${v.id}:${k}`;
        if (!groups.has(key)) groups.set(key, { v, k, list: [] });
        groups.get(key).list.push({ road, o });
      }
    }
    const joints = new Map();
    const trunks = [];
    for (const { v, k, list } of groups.values()) {
      const E = exitAt(v, k);
      let J = null;
      if (list.length >= 2) {
        // Le carrefour : assez loin pour se voir, jamais plus loin que le tiers du trajet le plus court.
        let reach = Infinity;
        for (const { o } of list) reach = Math.min(reach, Math.hypot(o.x - E.x, o.y - E.y) - Territory.radius(o));
        const L = Math.max(120, Math.min(600, reach * 0.3));
        J = { x: E.x + E.ux * L, y: E.y + E.uy * L };
        trunks.push({ points: [{ x: E.x, y: E.y }, J], roads: list.map((x) => x.road) });
      }
      for (const { road } of list) joints.set(`${road.a}>${road.b}@${v.id}`, { E: { x: E.x, y: E.y }, J, u: { x: E.ux, y: E.uy } });
    }
    const paths = new Map();
    for (const road of state.roads) {
      const [a, b] = ends(state, road);
      if (!a || !b) continue;
      const ja = joints.get(`${road.a}>${road.b}@${a.id}`), jb = joints.get(`${road.a}>${road.b}@${b.id}`);
      const curve = bend(state, a, b, ja.J || ja.E, ja.u, jb.J || jb.E, jb.u);
      paths.set(`${road.a}>${road.b}`, [
        { x: a.x, y: a.y }, ...(ja.J ? [ja.E] : []), ...curve, ...(jb.J ? [jb.E] : []), { x: b.x, y: b.y },
      ]);
    }
    const net = { sig, paths, trunks };
    caches.set(state, net);
    return net;
  }

  // Tracé de `from` à `to` : [cœur, sortie, …la grande route…, sortie, cœur], le même dans les deux sens.
  // Hors du réseau (pas de route entre eux), un tracé seul.
  function route(state, from, to) {
    const [lo, hi] = from.id < to.id ? [from, to] : [to, from];
    let path = network(state).paths.get(`${lo.id}>${hi.id}`);
    if (!path) {
      const ea = exitAt(lo, gateIndex(lo, hi)), eb = exitAt(hi, gateIndex(hi, lo));
      path = [{ x: lo.x, y: lo.y }, ...bend(state, lo, hi, ea, { x: ea.ux, y: ea.uy }, eb, { x: eb.ux, y: eb.uy }), { x: hi.x, y: hi.y }];
    }
    return from === lo ? path : path.slice().reverse();
  }

  // Les troncs communs du réseau : [{ points: [sortie, carrefour], roads }].
  function trunks(state) {
    return network(state).trunks;
  }

  function pathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    return len;
  }

  // Point d'un tracé, à la fraction f (0 à 1) de sa longueur.
  function along(points, f) {
    let left = Math.max(0, Math.min(1, f)) * pathLength(points);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (left <= len || i === points.length - 1) {
        const k = len > 0 ? Math.min(1, left / len) : 0;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
      left -= len;
    }
    return { x: points[0].x, y: points[0].y };
  }

  // Le morceau d'un tracé entre les fractions f0 et f1 de sa longueur.
  function slice(points, f0, f1) {
    const total = pathLength(points);
    const s0 = Math.max(0, f0) * total, s1 = Math.min(1, f1) * total;
    const out = [along(points, f0)];
    let at = 0;
    for (let i = 1; i < points.length; i++) {
      at += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (at > s0 && at < s1) out.push({ x: points[i].x, y: points[i].y });
    }
    out.push(along(points, f1));
    return out;
  }

  function ends(state, road) {
    return [Villages.byId(state, road.a), Villages.byId(state, road.b)];
  }

  function length(state, road) {
    const [a, b] = ends(state, road);
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function isDone(state, road) {
    return road.work >= length(state, road);
  }

  function between(state, a, b) {
    return state.roads.find((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id)) || null;
  }

  // Villages reliés à `v` par une route achevée.
  function neighbors(state, v) {
    const list = [];
    for (const r of state.roads) {
      if (!isDone(state, r)) continue;
      if (r.a === v.id) list.push(Villages.byId(state, r.b));
      else if (r.b === v.id) list.push(Villages.byId(state, r.a));
    }
    return list.filter(Boolean);
  }

  // Le village le plus proche de `v` qui ne lui est pas encore relié (ni en chantier), à portée de route.
  function candidate(state, v) {
    let best = null;
    let bestD = CONFIG.roads.maxLength;
    for (const o of state.villages) {
      if (o === v || between(state, v, o)) continue;
      const d = Math.hypot(o.x - v.x, o.y - v.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  function cost(state, from, to) {
    const c = CONFIG.roads;
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    return { light: Math.ceil(c.costPerUnit * d * Math.pow(c.growth, state.roads.length)) };
  }

  function plan(state, from, to) {
    const road = { a: Math.min(from.id, to.id), b: Math.max(from.id, to.id), work: 0 };
    state.roads.push(road);
    return road;
  }

  // Les bâtisseurs des deux bouts avancent les routes en chantier. Renvoie les routes achevées.
  // `statsOf(village)` donne les caractéristiques d'un village (rythme de construction).
  function advance(state, statsOf, seconds) {
    const done = [];
    for (const r of state.roads) {
      const total = length(state, r);
      if (r.work >= total) continue;
      let rate = 0;
      for (const v of ends(state, r)) if (v) rate += (v.beings.batisseur || 0) * statsOf(v).buildRate;
      if (rate <= 0) continue;
      r.work = Math.min(total, r.work + rate * CONFIG.roads.buildSpeed * seconds);
      if (r.work >= total) done.push(r);
    }
    return done;
  }

  // Distance de (x, y) au segment [a, b].
  function toSegment(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    return Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
  }

  // Le point (x, y) longe-t-il une route achevée ?
  function onRoad(state, x, y) {
    for (const r of state.roads) {
      const [a, b] = ends(state, r);
      if (!a || !b || r.work < Math.hypot(a.x - b.x, a.y - b.y)) continue;
      const path = route(state, a, b);
      for (let i = 1; i < path.length; i++) if (toSegment(x, y, path[i - 1], path[i]) <= CONFIG.roads.near) return true;
    }
    return false;
  }

  Catalog.register({
    id: 'route',
    tab: 'territoire',
    order: -5,
    name: 'Route',
    desc: 'Une route de lumière vers le village le plus proche qui n’est pas encore relié à celui-ci. '
      + 'Les bâtisseurs des deux bouts la construisent. Ta lumière y file plus vite, les caravanes y passent.',
    revealed: (state) => state.roads.length > 0 || state.villages.length >= 2,
    cost: (state) => {
      const v = Villages.current(state);
      const to = v && candidate(state, v);
      return to ? cost(state, v, to) : {}; // rien à relier : l'article est bloqué, sans prix affiché
    },
    blocked: (state) => {
      const v = Villages.current(state);
      if (!v) return 'rejoins un village';
      const to = candidate(state, v);
      if (!to) return 'aucun village à relier';
      if (!(v.beings.batisseur > 0) && !(to.beings.batisseur > 0)) return 'il faut un bâtisseur';
      return null;
    },
    apply: (state) => {
      const v = Villages.current(state);
      plan(state, v, candidate(state, v));
    },
    label: (state) => {
      const v = Villages.current(state);
      return v ? `×${state.roads.filter((r) => r.a === v.id || r.b === v.id).length}` : '';
    },
    effect: (state) => {
      const v = Villages.current(state);
      const to = v && candidate(state, v);
      return to ? `vers ${Villages.type(to.type).name.toLowerCase()} · ${Math.round(Math.hypot(to.x - v.x, to.y - v.y))}` : '';
    },
  });

  Vide.Roads = {
    ends, length, isDone, between, neighbors, candidate, cost, plan, advance, toSegment, onRoad,
    exit, route, trunks, network, pathLength, along, slice,
  };
})(globalThis.Vide);
