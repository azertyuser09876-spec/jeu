// Les enceintes d'un village : des murailles circulaires posées sur les boulevards de son plan (voir plan.js) ;
// une couche de plus quand il grandit. Elles bloquent tout ce qui bouge — ta lumière, les êtres, les ombres, les
// expéditions — sauf les colosses. Leurs portes, au bout des avenues, s'ouvrent à la lumière et jamais aux
// ombres : pour entrer, une ombre doit abattre un pan (une brèche, que les bâtisseurs relèvent).
// État persistant : village.walls = [{ n, work, broken: [pans abattus] }] (n : numéro du boulevard).
// La solidité des pans abîmés vit dans game.wallHp (oubliée au chargement : un pan debout repart intact).
// Les bases des ombres (v.dark) ont leurs remparts d'ombre : sans porte pour la lumière, qui doit les abattre,
// et que les ombres traversent comme si de rien n'était.
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Plan, Territory, Villages } = Vide;

  const TAU = Math.PI * 2;

  const radius = (w) => w.n * Plan.STREET;
  const length = (w) => TAU * radius(w);
  const workOf = (w) => length(w) * CONFIG.walls.workPerUnit;
  const isDone = (w) => w.work >= workOf(w);
  // Nombre de pans (chacun a sa solidité).
  const segments = (w) => Math.max(8, Math.round(length(w) / CONFIG.walls.segment));

  // Pan d'une enceinte où tombe une direction, et direction du milieu d'un pan.
  function segmentAt(v, w, angle) {
    const count = segments(w);
    let a = (angle - Plan.turn(v)) % TAU;
    if (a < 0) a += TAU;
    return Math.min(count - 1, Math.floor((a / TAU) * count));
  }

  function segmentAngle(v, w, seg) {
    return Plan.turn(v) + ((seg + 0.5) / segments(w)) * TAU;
  }

  // Une porte, dans cette direction ? (Au bout de chaque avenue.)
  function isGate(v, w, angle) {
    return Plan.offAvenue(v, angle) * radius(w) < CONFIG.walls.gate;
  }

  // Passe-t-on dans cette direction : par une porte (la lumière seulement, chez elle), ou par une brèche (tout le
  // monde) ?
  function open(v, w, angle, light) {
    if (light && !v.dark && isGate(v, w, angle)) return true;
    return w.broken.length > 0 && w.broken.includes(segmentAt(v, w, angle));
  }

  // Part du tracé d'un cercle de rayon r (autour du cœur) qui tombe dans le territoire.
  function insideShare(v, r) {
    const N = 48;
    let k = 0;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      if (Territory.contains(v, v.x + Math.cos(a) * r, v.y + Math.sin(a) * r)) k++;
    }
    return k / N;
  }

  // Le boulevard de la prochaine enceinte : le plus loin possible dans le territoire, au moins `layerGap`
  // boulevards au-delà de la précédente. null s'il n'y en a pas (le village doit grandir).
  function nextRing(v) {
    const c = CONFIG.walls;
    const last = v.walls.reduce((m, w) => Math.max(m, w.n), 0);
    const min = last ? last + c.layerGap : c.minBoulevard;
    for (let n = Math.floor((Territory.radius(v) * c.reach) / Plan.STREET); n >= min; n--) {
      if (insideShare(v, n * Plan.STREET) >= c.inside) return n;
    }
    return null;
  }

  // Prix d'une enceinte : sa longueur (bâtir ne renchérit jamais ; une enceinte plus grande coûte plus).
  function cost(n) {
    return { light: Math.ceil(CONFIG.walls.costPerUnit * TAU * n * Plan.STREET) };
  }

  function plan(v) {
    const n = nextRing(v);
    if (n === null) return null;
    const w = { n, work: 0, broken: [] };
    v.walls.push(w);
    v.walls.sort((a, b) => a.n - b.n);
    return w;
  }

  // L'enceinte en chantier d'un village (une à la fois), ou null.
  function site(v) {
    return v.walls.find((w) => !isDone(w)) || null;
  }

  // Ajoute du travail ; renvoie vrai si l'enceinte vient d'être achevée.
  function addWork(w, amount) {
    if (isDone(w)) return false;
    w.work = Math.min(workOf(w), w.work + amount);
    return isDone(w);
  }

  // Le front du chantier : il fait le tour du cœur à mesure que le mur s'élève.
  function front(v, w) {
    const a = Plan.turn(v) + (w.work / workOf(w)) * TAU;
    const r = radius(w);
    return { x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r, a };
  }

  // --- Solidité des pans ---

  const owner = (v) => (v.dark ? 'n' : '') + v.id;
  const key = (v, w, seg) => `${owner(v)}:${w.n}:${seg}`;

  function hp(game, v, w, seg) {
    if (w.broken.includes(seg)) return 0;
    const known = game.wallHp.get(key(v, w, seg));
    return known === undefined ? CONFIG.walls.hp : known;
  }

  // Blesse un pan debout ; renvoie vrai s'il vient de tomber (une brèche).
  function damage(game, v, w, seg, amount) {
    if (!isDone(w) || w.broken.includes(seg)) return false;
    const left = hp(game, v, w, seg) - amount;
    if (left > 0) {
      game.wallHp.set(key(v, w, seg), left);
      return false;
    }
    game.wallHp.delete(key(v, w, seg));
    w.broken.push(seg);
    return true;
  }

  // Relève un pan ; renvoie vrai si une brèche vient d'être refermée.
  function repair(game, v, w, seg, amount) {
    const now = Math.min(CONFIG.walls.hp, (w.broken.includes(seg) ? game.wallHp.get(key(v, w, seg)) || 0 : hp(game, v, w, seg)) + amount);
    if (now < CONFIG.walls.hp) {
      game.wallHp.set(key(v, w, seg), now);
      return false;
    }
    game.wallHp.delete(key(v, w, seg));
    const i = w.broken.indexOf(seg);
    if (i < 0) return false;
    w.broken.splice(i, 1);
    return true;
  }

  // Le pan le plus abîmé d'un village (les brèches d'abord, puis le plus proche) : { w, seg, x, y }, ou null.
  function mostDamaged(game, v, x, y) {
    let best = null;
    let bestScore = Infinity;
    const consider = (w, seg) => {
      const a = segmentAngle(v, w, seg);
      const r = radius(w) - CONFIG.walls.thickness;
      const px = v.x + Math.cos(a) * r, py = v.y + Math.sin(a) * r;
      const score = (w.broken.includes(seg) ? 0 : 1e9) + Math.hypot(px - x, py - y);
      if (score < bestScore) {
        bestScore = score;
        best = { w, seg, x: px, y: py };
      }
    };
    for (const w of v.walls) for (const seg of w.broken) consider(w, seg);
    if (game.wallHp.size) {
      const prefix = `${owner(v)}:`;
      for (const k of game.wallHp.keys()) {
        if (!k.startsWith(prefix)) continue;
        const [, n, seg] = k.split(':').map(Number);
        const w = v.walls.find((o) => o.n === n);
        if (w && !w.broken.includes(seg)) consider(w, seg);
      }
    }
    return best;
  }

  // --- Ce qui bouge ---

  // Villages (et bases des ombres) qui ont au moins une enceinte achevée : les seuls à regarder.
  function walled(state) {
    const list = [];
    for (const v of state.villages) if (v.walls.some(isDone)) list.push(v);
    for (const n of state.nests) if (n.walls && n.walls.some(isDone)) list.push(n);
    return list;
  }

  // Garde un corps du bon côté des murailles qu'il ne peut pas franchir. (x0, y0) : sa position avant le pas ;
  // `size` : son rayon ; `light` : les portes lui sont ouvertes ; `vel` : sa vitesse ({ x, y } ou { vx, vy }), dont
  // on retire ce qui pousse contre le mur (il glisse le long). Renvoie le mur heurté { v, w, seg, nx, ny } (n : vers
  // le mur), ou null.
  function hold(list, body, x0, y0, size, light, vel) {
    const T = CONFIG.walls.thickness / 2 + size;
    for (const v of list) {
      if (v.dark && !light) continue; // les ombres traversent leurs remparts
      const dx = body.x - v.x, dy = body.y - v.y;
      const d1 = Math.hypot(dx, dy);
      const d0 = Math.hypot(x0 - v.x, y0 - v.y);
      for (const w of v.walls) {
        if (!isDone(w)) continue;
        const r = radius(w);
        const side = d0 < r ? -1 : 1;
        // Ni dans l'épaisseur du mur, ni de l'autre côté : rien à faire.
        if (side < 0 ? d1 < r - T : d1 > r + T) continue;
        const angle = Math.atan2(dy, dx);
        if (open(v, w, angle, light)) continue;
        const ux = d1 > 0 ? dx / d1 : 1, uy = d1 > 0 ? dy / d1 : 0;
        body.x = v.x + ux * (r + side * T);
        body.y = v.y + uy * (r + side * T);
        // Vers le mur : -side le long du rayon.
        const nx = -side * ux, ny = -side * uy;
        if (vel) {
          const fast = 'vx' in vel;
          const vx = fast ? vel.vx : vel.x, vy = fast ? vel.vy : vel.y;
          const into = vx * nx + vy * ny;
          if (into > 0) {
            if (fast) {
              vel.vx -= into * nx;
              vel.vy -= into * ny;
            } else {
              vel.x -= into * nx;
              vel.y -= into * ny;
            }
          }
        }
        return { v, w, seg: segmentAt(v, w, angle), nx, ny };
      }
    }
    return null;
  }

  // Par où passer pour aller de (x, y) à (tx, ty) quand une enceinte les sépare : vers la porte qui fait le moins
  // de détour (en restant de son côté), puis au-delà. null s'il n'y a pas de mur entre les deux.
  function route(list, x, y, tx, ty) {
    const step = TAU / Plan.AVENUES;
    for (const v of list) {
      if (v.dark) continue; // un rempart d'ombre n'a pas de porte pour la lumière : il faut l'abattre
      const d = Math.hypot(x - v.x, y - v.y), dTarget = Math.hypot(tx - v.x, ty - v.y);
      let first = null;
      for (const w of v.walls) {
        if (!isDone(w)) continue;
        const r = radius(w);
        if ((d < r) === (dTarget < r)) continue;
        // Le premier mur sur le chemin : du dedans, le plus proche au-dessus ; du dehors, le plus grand en dessous.
        if (!first || (d < r ? r < radius(first) : r > radius(first))) first = w;
      }
      if (!first) continue;
      const r = radius(first);
      const turn = Plan.turn(v);
      let gate = 0, best = Infinity;
      for (let k = 0; k < Plan.AVENUES; k++) {
        const a = turn + k * step;
        const gx = v.x + Math.cos(a) * r, gy = v.y + Math.sin(a) * r;
        const c = Math.hypot(gx - x, gy - y) + Math.hypot(tx - gx, ty - gy);
        if (c < best) {
          best = c;
          gate = a;
        }
      }
      const ours = d < r ? -1 : 1;
      const cx = Math.cos(gate), cy = Math.sin(gate);
      // Devant la porte, de son côté, dans l'axe de l'avenue ; une fois devant, on la franchit.
      const ax = v.x + cx * (r + ours * 34), ay = v.y + cy * (r + ours * 34);
      const lateral = Math.abs((x - v.x) * -cy + (y - v.y) * cx);
      const facing = (x - v.x) * cx + (y - v.y) * cy > 0;
      const passing = facing && lateral < CONFIG.walls.gate * 0.6 && Math.abs(d - r) < 40;
      if (!passing && Math.hypot(ax - x, ay - y) > 18) return { x: ax, y: ay };
      return { x: v.x + cx * (r - ours * 44), y: v.y + cy * (r - ours * 44) };
    }
    return null;
  }

  // --- Pendant l'absence ---

  // Les bâtisseurs relèvent les brèches, puis avancent l'enceinte en chantier avec ce qui leur reste de temps
  // (`reserved` : travail déjà pris par les bâtiments). Renvoie le nombre d'enceintes achevées.
  function advanceOffline(v, stats, seconds, reserved) {
    const builders = v.beings.batisseur || 0;
    if (!builders) return 0;
    for (const w of v.walls) w.broken.length = 0;
    const w = site(v);
    const budget = builders * stats.buildRate * seconds - (reserved || 0);
    if (!w || budget <= 0) return 0;
    return addWork(w, budget) ? 1 : 0;
  }

  Catalog.register({
    id: 'enceinte',
    tab: 'batiments',
    order: Vide.BUILDING_FAMILIES.indexOf('defense'),
    name: 'Enceinte',
    desc: 'Une muraille qui fait le tour du village, sur un de ses boulevards, avec une porte au bout de chaque avenue. '
      + 'Elle arrête tout, sauf les colosses ; ses portes s’ouvrent à la lumière, jamais aux ombres, qui doivent '
      + 'l’abattre. Une couche de plus quand le village grandit.',
    revealed: (state) => state.villages.some((v) => v.walls.length > 0) ||
      (state.stats.shadows > 0 && Villages.count(state, 'batisseur') > 0),
    cost: (state) => {
      const v = Villages.current(state);
      const n = v && nextRing(v);
      return n ? cost(n) : {}; // pas de place : l'article est bloqué, sans prix affiché
    },
    blocked: (state) => {
      const v = Villages.current(state);
      if (!v) return 'rejoins un village';
      if (!(v.beings.batisseur > 0)) return 'il faut un bâtisseur';
      if (site(v)) return 'une enceinte en chantier';
      if (nextRing(v) === null) return v.walls.length ? 'le village doit grandir' : 'territoire trop petit';
      return null;
    },
    apply: (state) => { plan(Villages.current(state)); },
    label: (state) => {
      const v = Villages.current(state);
      if (!v) return '';
      const done = v.walls.filter(isDone).length;
      return site(v) ? `×${done} · 1 en chantier` : `×${done}`;
    },
    effect: (state) => {
      const v = Villages.current(state);
      const n = v && nextRing(v);
      return n ? `rayon ${n * Plan.STREET} · ${Plan.AVENUES} portes` : '';
    },
  });

  Vide.Walls = {
    owner, radius, length, workOf, isDone, segments, segmentAt, segmentAngle, isGate, open, insideShare, nextRing, cost,
    plan, site, addWork, front, hp, damage, repair, mostDamaged, walled, hold, route, advanceOffline,
  };
})(globalThis.Vide);
