// Les fronts : là où le territoire d'un village touche la noirceur d'une base, les deux camps se disputent les
// cellules du contact. À chaque tour (CONFIG.fronts.every), sur chaque front, un camp attaque selon sa pression —
// les soldats et les tours d'un village (doublée s'il mène campagne contre cette base) ; le niveau et la garnison
// d'une base, et la rudesse de la guerre — la cellule la moins mûre de l'autre au contact. Elle cède d'autant moins
// qu'elle a mûri : le blanc pur et la noirceur profonde tiennent presque toujours, un cœur toujours. Prise, elle
// change de camp avec sa surface (l'économie suit) ; le bâtiment ou l'ouvrage qui s'y trouvait tombe. Les ombres
// n'avancent qu'en guerre ouverte (jamais pendant la tension) ; alors, la noirceur d'une base qui ne touche pas
// encore le village le plus proche rampe vers lui, une cellule à la fois, jusqu'au contact : une langue de noirceur
// neuve, fragile, que des soldats reprennent sans peine.
// Rien de persistant ici : les cellules et les surfaces sont celles des villages et des bases.
(function (Vide) {
  'use strict';
  const { CONFIG, Territory } = Vide;

  const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Les cellules au contact entre un village et une base : [{ vi, vj, ni, nj }] (au village, à la base, voisines).
  function contacts(v, nest) {
    const reach = Territory.radius(v) + Territory.radius(nest);
    if (Math.hypot(v.x - nest.x, v.y - nest.y) > reach * 1.6 + 4 * Territory.CELL) return [];
    const list = [];
    const villageFirst = v.cells.length <= nest.cells.length;
    const [small, big] = villageFirst ? [v, nest] : [nest, v];
    for (let k = 0; k < small.cells.length; k += 3) {
      const i = small.cells[k], j = small.cells[k + 1];
      for (const [di, dj] of N) {
        if (!Territory.has(big, i + di, j + dj)) continue;
        list.push(villageFirst ? { vi: i, vj: j, ni: i + di, nj: j + dj } : { vi: i + di, vj: j + dj, ni: i, nj: j });
      }
    }
    return list;
  }

  // Les cœurs ne tombent jamais (celui d'un village, ses anciens cœurs, celui d'une base).
  function heart(owner, i, j) {
    const at = (p) => Territory.cellOf(p.x) === i && Territory.cellOf(p.y) === j;
    return at(owner) || (owner.districts || []).some(at);
  }

  // Pression d'un village sur ce front : ses soldats, ses tours (et sa campagne contre cette base).
  function lightPressure(state, v, nest) {
    const f = CONFIG.fronts;
    let p = Vide.Colony.usedIn(v, 'armyCap') * f.perSoldier;
    p += (Vide.Structures.working(v, 'tour') + 2 * Vide.Structures.working(v, 'citadelle')) * f.perTower;
    if (v.campaign === nest.id) p *= 2;
    return p;
  }

  // Pression d'une base : son niveau, sa garnison, la guerre (rien pendant la tension, ni sans guerre).
  function darkPressure(state, nest) {
    if (!state.war || Vide.War.calm(state)) return 0;
    const f = CONFIG.fronts;
    let beasts = 0;
    for (const n of Object.values(nest.creatures || {})) beasts += n;
    return (f.darkBase + Vide.Nests.level(nest) * f.perLevel + beasts * f.perBeast) * Vide.War.raidScale(state);
  }

  // Chance qu'une cellule de cette maturité (0 à 100) cède à un assaut.
  function yieldChance(white) {
    return CONFIG.fronts.bite * (1 - CONFIG.fronts.hold * (white / 100));
  }

  // Un tour sur le front d'un village et d'une base. Renvoie ce qui s'est passé : null, ou { side (le camp qui a
  // pris), i, j, x, y, fallen (le bâtiment ou l'ouvrage tombé, ou null) }.
  function clash(state, v, nest, rng) {
    const list = contacts(v, nest);
    if (!list.length) return null;
    const pl = lightPressure(state, v, nest), pd = darkPressure(state, nest);
    if (pl + pd <= 0) return null;
    const dark = rng() < pd / (pl + pd);
    const [loser, winner] = dark ? [v, nest] : [nest, v];
    // La cellule la moins mûre du perdant, au contact (à égalité, au hasard).
    let best = null, bestWhite = Infinity;
    for (const c of list) {
      const i = dark ? c.vi : c.ni, j = dark ? c.vj : c.nj;
      if (heart(loser, i, j)) continue;
      const w = Territory.whiteOf(loser, i, j) * 100 + rng() * 0.5;
      if (w < bestWhite) {
        bestWhite = w;
        best = { i, j };
      }
    }
    if (!best || rng() >= yieldChance(Math.floor(bestWhite))) return null;
    Territory.lose(loser, best.i, best.j);
    Territory.claim(winner, best.i, best.j);
    // Ce qui s'y trouvait tombe.
    const inCell = (b) => Territory.cellOf(b.x) === best.i && Territory.cellOf(b.y) === best.j;
    const fallen = loser.buildings.find(inCell) || null;
    if (fallen) loser.buildings.splice(loser.buildings.indexOf(fallen), 1);
    const c = Territory.CELL;
    return { side: dark ? 'shadow' : 'light', i: best.i, j: best.j, x: (best.i + 0.5) * c, y: (best.j + 0.5) * c, fallen };
  }

  // Pour chaque base : la pointe de sa langue de noirceur (ses dernières cellules gagnées, [{ i, j }]), et l'attente
  // d'une base encerclée (aucune cellule libre autour d'elle) avant de chercher de nouveau.
  const tips = new WeakMap();
  const stuck = new WeakMap();

  // La noirceur d'une base rampe d'une cellule vers le village le plus proche (à portée de raid), si elle ne le
  // touche pas encore. Renvoie la cellule gagnée { i, j }, ou null.
  function creep(state, nest) {
    const wait = stuck.get(nest) || 0;
    if (wait > 0) {
      stuck.set(nest, wait - 1);
      return null;
    }
    const target = Vide.Villages.nearest(state, nest.x, nest.y);
    if (!target || Math.hypot(target.x - nest.x, target.y - nest.y) > CONFIG.nests.raidRange) return null;
    if (contacts(target, nest).length) return null;
    const owners = [...state.villages, ...state.nests];
    const c = Territory.CELL;
    const d2 = (i, j) => ((i + 0.5) * c - target.x) ** 2 + ((j + 0.5) * c - target.y) ** 2;
    // La cellule libre, voisine de ces cellules de la base, la plus proche du village.
    const pick = (from) => {
      let best = null, bestD = Infinity;
      for (const p of from) {
        if (!Territory.has(nest, p.i, p.j)) continue;
        for (const [di, dj] of N) {
          const i = p.i + di, j = p.j + dj;
          const d = d2(i, j);
          if (d < bestD && !Territory.owned(owners, i, j)) {
            bestD = d;
            best = { i, j };
          }
        }
      }
      return best;
    };
    // D'abord autour de sa pointe ; sinon, autour des cellules de la base les plus proches du village ; sinon, tout
    // autour d'elle.
    const near = (count) => {
      const list = [];
      for (let k = 0; k < nest.cells.length; k += 3) list.push({ i: nest.cells[k], j: nest.cells[k + 1], d: d2(nest.cells[k], nest.cells[k + 1]) });
      list.sort((a, b) => a.d - b.d);
      return count ? list.slice(0, count) : list;
    };
    let best = pick(tips.get(nest) || []) || pick(near(8)) || pick(near(0));
    if (!best) {
      stuck.set(nest, 25);
      return null;
    }
    Territory.claim(nest, best.i, best.j);
    tips.set(nest, [best, ...(tips.get(nest) || [])].slice(0, 6));
    return best;
  }

  // Un tour sur tous les fronts. Renvoie les prises : [{ village, nest, side, x, y, fallen }].
  function step(state, rng) {
    const taken = [];
    // En guerre ouverte, la noirceur rampe vers tes villages (à son rythme : creepEvery, plus vite quand la guerre
    // est rude).
    if (state.war && !Vide.War.calm(state)) {
      const chance = (CONFIG.fronts.every / CONFIG.fronts.creepEvery) * Vide.War.pace(state);
      for (const nest of state.nests) if (rng() < chance) creep(state, nest);
    }
    for (const v of state.villages) {
      for (const nest of state.nests.slice()) {
        const r = clash(state, v, nest, rng);
        if (r) taken.push({ village: v, nest, ...r });
      }
    }
    return taken;
  }

  function create(game) {
    game.fronts = {
      clock: CONFIG.fronts.every, rng: Vide.util.rng(game.state.seed ^ 0x66726f6e), active: new Map(),
      taken: { light: 0, shadow: 0 }, // cellules prises par chaque camp depuis le début de la partie (pour le robot)
    };
  }

  // Pendant le jeu : un tour toutes les `every` secondes ; ce qui tombe s'annonce (un message par front et par
  // minute au plus).
  function update(game, dt) {
    const g = game.fronts;
    g.clock -= dt;
    if (g.clock > 0) return;
    g.clock = CONFIG.fronts.every;
    for (const t of step(game.state, g.rng)) {
      g.taken[t.side]++;
      const key = `${t.village.id}:${t.nest.id}:${t.side}`;
      const last = g.active.get(key);
      if (last === undefined || game.time - last >= CONFIG.fronts.tellEvery) {
        g.active.set(key, game.time);
        Vide.Sim.emit(game, 'front', { side: t.side, village: t.village.type, x: t.x, y: t.y });
      }
      if (t.fallen && t.side === 'shadow') {
        Vide.Sim.emit(game, 'structureLost', { kind: t.fallen.type, village: t.village.type, x: t.fallen.x, y: t.fallen.y });
      } else if (t.fallen) {
        const echoes = CONFIG.nests.workEchoes * game.stats.echoGain;
        game.state.echoes += echoes;
        Vide.Sim.emit(game, 'workDown', { x: t.fallen.x, y: t.fallen.y, kind: t.fallen.type, echoes });
      }
    }
  }

  Vide.Fronts = { contacts, heart, lightPressure, darkPressure, yieldChance, clash, creep, step, create, update };
})(globalThis.Vide);
