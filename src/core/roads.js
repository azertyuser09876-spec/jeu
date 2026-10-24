// Routes de lumière entre villages. On en planifie une depuis un village, vers le plus proche qui ne lui est pas
// encore relié ; les bâtisseurs des deux bouts la construisent, chacun depuis son cœur.
// État persistant : state.roads = [{ a, b, work }] (numéros des villages, a < b ; work : longueur déjà bâtie).
// Sur une route achevée, la lumière du joueur file plus vite ; les caravanes y passent (voir trade.js).
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Villages } = Vide;

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
      if (a && b && r.work >= Math.hypot(a.x - b.x, a.y - b.y) && toSegment(x, y, a, b) <= CONFIG.roads.near) return true;
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

  Vide.Roads = { ends, length, isDone, between, neighbors, candidate, cost, plan, advance, toSegment, onRoad };
})(globalThis.Vide);
