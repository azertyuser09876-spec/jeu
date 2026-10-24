(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Stats, Territory, Villages, Catalog, Offline, Sim } = Vide;

  // Partie avec un village de jardins à l'origine.
  function withVillage() {
    const state = State.create(1);
    village(state);
    return state;
  }

  test('au départ, aucun village ni territoire', () => {
    const state = State.create(1);
    assert.deepEqual(state.villages, []);
    assert.equal(Territory.isInside(state, 0, 0), false);
    assert.equal(Territory.distanceToEdge(state, 0, 0), Infinity);
  });

  test('un village fondé a un territoire de départ autour de son cœur', () => {
    const state = State.create(1);
    const v = village(state, { x: 900, y: -300 });
    assert.near(Territory.radius(v), CONFIG.territory.startRadius, 1e-9);
    assert.ok(Territory.isInside(state, 900, -300));
    assert.equal(Territory.isInside(state, 0, 0), false);
    assert.near(Territory.distanceToEdge(state, 900, -100), 200 - CONFIG.territory.startRadius, 1e-9);
  });

  test('le territoire grandit, de plus en plus lentement', () => {
    const state = withVillage();
    const v = state.villages[0];
    const stats = Villages.local(state, v);
    const r0 = Territory.radius(v);
    Territory.advance(v, stats, 600);
    const r1 = Territory.radius(v);
    Territory.advance(v, stats, 600);
    const r2 = Territory.radius(v);
    assert.ok(r1 > r0 && r2 > r1);
    assert.ok(r2 - r1 < r1 - r0, 'le deuxième gain doit être plus petit');
  });

  test('la croissance donne le même résultat en une fois ou image par image', () => {
    const a = withVillage(), b = withVillage();
    const stats = Villages.local(a, a.villages[0]);
    const once = Territory.advance(a.villages[0], stats, 60);
    let steps = 0;
    for (let i = 0; i < 3600; i++) steps += Territory.advance(b.villages[0], stats, 1 / 60);
    assert.near(a.villages[0].area, b.villages[0].area, 1e-6);
    assert.near(steps, once, once * 1e-9);
  });

  test('le territoire rayonne de la lumière pendant le jeu', () => {
    const game = Sim.create(withVillage());
    game.field.particles.length = 0;
    game.state.player.x = 50000; // le joueur ne ramasse pas le jardin
    for (let i = 0; i < 600; i++) Sim.step(game, CONFIG.step, Sim.emptyInput());
    assert.ok(game.state.light > 0);
    assert.equal(game.state.totalLight, game.state.light);
  });

  test('chaque village grandit et rayonne de son côté', () => {
    const state = State.create(1);
    const a = village(state);
    const b = village(state, { x: 3000 });
    const game = Sim.create(state);
    for (let i = 0; i < 600; i++) Sim.step(game, CONFIG.step, Sim.emptyInput());
    const start = Math.PI * CONFIG.territory.startRadius ** 2;
    assert.ok(a.area > start && b.area > start);
    // Les jardins de l'origine et ceux du second village grandissent au même rythme.
    assert.near(a.area, b.area, 1e-6);
  });

  test('fonder un village émet un événement pour l’interface', () => {
    const state = State.create(1);
    const game = Sim.create(state);
    village(state, { type: 'bastion' });
    Sim.step(game, CONFIG.step, Sim.emptyInput());
    const e = game.events.find((x) => x.type === 'village');
    assert.ok(e && e.village === 'bastion' && e.first);
  });

  test('la pulsation se recharge plus vite dans un territoire', () => {
    const inside = Sim.create(withVillage());
    const outside = Sim.create(withVillage());
    outside.state.player.x = 5000;
    for (const g of [inside, outside]) {
      Sim.pulse(g);
      for (let i = 0; i < 60; i++) Sim.step(g, CONFIG.step, Sim.emptyInput());
    }
    assert.ok(inside.pulse.cooldown < outside.pulse.cooldown - 0.5);
  });

  test('les améliorations du territoire apparaissent une fois un village fondé', () => {
    const state = State.create(1);
    state.totalLight = 1e6;
    assert.equal(Catalog.get('expansion').revealed(state), false);
    village(state);
    assert.ok(Catalog.get('expansion').revealed(state));
  });

  test("l'absence fait grandir les territoires et rapporte de la lumière", () => {
    const state = withVillage();
    const far = village(state, { x: 4000 });
    const r0 = Territory.radius(state.villages[0]);
    const report = Offline.apply(state, 3600);
    assert.equal(report.applied, 3600);
    assert.equal(report.capped, false);
    assert.ok(report.light > 0 && state.light === report.light);
    assert.ok(report.radiusAfter > r0);
    assert.ok(Territory.radius(far) > r0, 'le second village grandit aussi');
    assert.equal(report.villages, 2);
    assert.ok(Offline.worthShowing(report));
  });

  test("l'absence est plafonnée par la Mémoire", () => {
    const state = withVillage();
    const cap = Stats.compute(state).offlineCap;
    const report = Offline.apply(state, cap * 3);
    assert.equal(report.applied, cap);
    assert.ok(report.capped);
    state.upgrades.memory = 2;
    assert.equal(Stats.compute(state).offlineCap, cap + 2 * 3600);
  });

  test('une absence courte, négative ou invalide ne fait rien', () => {
    for (const seconds of [-50, NaN, Infinity * 0]) {
      const state = withVillage();
      const report = Offline.apply(state, seconds);
      assert.equal(report.applied, 0);
      assert.equal(state.light, 0);
    }
    assert.equal(Offline.worthShowing(Offline.apply(withVillage(), 30)), false);
  });

  test("sans village, l'absence ne rapporte rien", () => {
    const state = State.create(1);
    const report = Offline.apply(state, 3600);
    assert.equal(report.light, 0);
    assert.equal(report.radiusAfter, 0);
    assert.equal(Offline.worthShowing(report), false);
  });

  // --- Forme (grille de cellules) ---

  function cellsOf(v) {
    const list = [];
    for (let k = 0; k < v.cells.length; k += 3) list.push({ i: v.cells[k], j: v.cells[k + 1], w: v.cells[k + 2] });
    return list;
  }

  test('la forme suit la surface : une cellule par 40×40, en partant du cœur, d’un seul tenant', () => {
    const state = State.create(1);
    const v = village(state, { x: 1000, y: 333 });
    assert.equal(v.cells[0], Territory.cellOf(1000));
    assert.equal(v.cells[1], Territory.cellOf(333));
    Territory.advance(v, Villages.local(state, v), 3000);
    assert.equal(v.cells.length / 3, Territory.targetCells(v));
    // Toutes les cellules sont reliées au cœur.
    const cells = cellsOf(v);
    const seen = new Set([`${cells[0].i},${cells[0].j}`]);
    const queue = [cells[0]];
    while (queue.length) {
      const c = queue.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${c.i + di},${c.j + dj}`;
        if (!seen.has(k) && Territory.has(v, c.i + di, c.j + dj)) {
          seen.add(k);
          queue.push({ i: c.i + di, j: c.j + dj });
        }
      }
    }
    assert.equal(seen.size, cells.length);
  });

  test('la forme est organique mais déterministe', () => {
    const make = () => {
      const state = State.create(1);
      const v = village(state, { radius: 400 });
      return v.cells.join(',');
    };
    assert.equal(make(), make());
    // Ni un disque parfait : certaines cellules dépassent le rayon équivalent, d'autres manquent en deçà.
    const state = State.create(1);
    const v = village(state, { radius: 400 });
    const R = Territory.radius(v);
    const out = cellsOf(v).filter((c) => Math.hypot((c.i + 0.5) * 40, (c.j + 0.5) * 40) > R + 20).length;
    assert.ok(out > 0, 'un bord irrégulier');
  });

  test('le territoire pousse vers ses bâtiments', () => {
    const state = State.create(1);
    const v = village(state, { radius: 200 });
    v.buildings.push({ type: 'phare', x: 450, y: 0, work: 0 });
    v.area = Math.PI * 400 * 400;
    Territory.grow(v);
    const east = cellsOf(v).filter((c) => c.i > 0).length;
    const west = cellsOf(v).filter((c) => c.i < -1).length;
    assert.ok(east > west * 1.15, `${east} à l’est, ${west} à l’ouest`);
    assert.ok(Territory.contains(v, 430, 0), 'le phare finit dans le territoire');
  });

  test('le cœur blanchit d’abord, puis le blanc se répand lentement, sans jamais toucher le bord', () => {
    const state = State.create(1);
    const v = village(state, { radius: 500 });
    const stats = Villages.local(state, v);
    const white = (x, y) => Territory.whiteOf(v, Territory.cellOf(x), Territory.cellOf(y));
    Territory.whiten(v, stats, CONFIG.territory.whiteTime / 2);
    assert.near(white(0, 0), 0.5, 0.011);
    assert.equal(white(40, 0), 0, 'les voisines attendent que le cœur soit tout blanc');
    Territory.whiten(v, stats, CONFIG.territory.whiteTime / 2);
    assert.equal(white(0, 0), 1);
    Territory.whiten(v, stats, CONFIG.territory.whiteTime * 30);
    const R = Territory.radius(v);
    for (const c of cellsOf(v)) {
      const d = Math.hypot((c.i + 0.5) * 40, (c.j + 0.5) * 40);
      if (c.w > 0) assert.ok(d <= R * CONFIG.territory.whiteReach * 1.2 + 1, `blanc trop loin : ${d}`);
    }
    assert.ok(Territory.whiteness(v) > 0.15 && Territory.whiteness(v) < CONFIG.territory.whiteReach ** 2 + 0.05);
  });

  test('pendant l’absence, le blanc avance comme en jeu', () => {
    const make = () => {
      const state = State.create(1);
      const v = village(state, { radius: 450 });
      return { v, stats: Villages.local(state, v) };
    };
    const a = make(), b = make();
    Territory.whiten(a.v, a.stats, 3600);
    for (let i = 0; i < 3600; i++) Territory.whiten(b.v, b.stats, 1);
    assert.near(Territory.whiteness(a.v), Territory.whiteness(b.v), 0.02);
  });

  test('dans le blanc, les ombres brûlent plus vite', () => {
    const burn = (whiteTime) => {
      const state = State.create(9);
      const v = village(state, { radius: 400 });
      Territory.whiten(v, Villages.local(state, v), whiteTime);
      state.player.x = 50000;
      const game = Sim.create(state);
      const s = Vide.Shadows.spawn(game, 'massive', 5, 5, 'roam');
      const hp = s.hp;
      Vide.Shadows.update(game, 0.1);
      return hp - s.hp;
    };
    assert.near(burn(CONFIG.territory.whiteTime * 2), CONFIG.territory.whiteBurn * burn(0), 1e-9);
  });

  test('le contour des cellules forme des boucles fermées', () => {
    const v = { id: 1, x: 0, y: 0, area: 0, cells: [], buildings: [] };
    v.cells.push(0, 0, 0);
    assert.deepEqual(Territory.outline(v).map((l) => l.length), [4]);
    v.cells.push(1, 0, 0, 1, 1, 100); // un L
    assert.deepEqual(Territory.outline(v).map((l) => l.length), [6]);
    assert.deepEqual(Territory.outline(v, 50).map((l) => l.length), [4], 'contour du blanc seulement');
    // Un anneau : un bord extérieur et un trou.
    const ring = { id: 2, x: 0, y: 0, area: 0, cells: [], buildings: [] };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) ring.cells.push(i, j, 0);
    assert.equal(Territory.outline(ring).length, 2);
  });

  test('un grand territoire se dessine vite (taille de fin de partie)', () => {
    const state = State.create(1);
    const t0 = Date.now();
    const v = village(state, { radius: 2000 });
    const stats = Villages.local(state, v);
    Territory.whiten(v, stats, 4 * 3600);
    Territory.outline(v);
    assert.equal(v.cells.length / 3, Territory.targetCells(v));
    assert.ok(Date.now() - t0 < 3000, `${Date.now() - t0} ms`);
  });

  test('les cellules sauvegardées sont relues et nettoyées ; ce qui manque repousse', () => {
    const { Save } = Vide;
    const area = Math.PI * 200 * 200;
    const raw = { id: 1, x: 0, y: 0, area, cells: [0, 0, 150, 0, 0, 3, 1, 0, -5, 2.5, 1, 0, 'a', 2, 0, 1, 1] };
    const v = Save.sanitize({ villages: [raw] }).villages[0];
    assert.deepEqual(v.cells.slice(0, 6), [0, 0, 100, 1, 0, 0]);
    assert.equal(v.cells.length / 3, Territory.targetCells(v));
    const tooMany = [];
    for (let i = 0; i < 100; i++) tooMany.push(i, 0, 0);
    const small = Save.sanitize({ villages: [{ id: 1, x: 0, y: 0, cells: tooMany }] }).villages[0];
    assert.equal(small.cells.length / 3, Territory.targetCells(small));
  });

  test('chaque type de village a sa silhouette', () => {
    const silhouette = (type) => {
      const state = State.create(1);
      const v = village(state, { radius: 500, type });
      const R = Territory.radius(v);
      const cells = cellsOf(v);
      // Coins : cellules loin des deux axes (un carré en a beaucoup, un disque peu).
      const corners = cells.filter((c) => Math.min(Math.abs(c.i + 0.5), Math.abs(c.j + 0.5)) * 40 > 0.62 * R).length;
      // Régularité du bord : écart des distances du contour au cœur, rapporté à leur moyenne.
      const pts = Territory.outline(v).sort((a, b) => b.length - a.length)[0];
      const d = pts.map(([x, y]) => Math.hypot(x, y));
      const mean = d.reduce((a, b) => a + b, 0) / d.length;
      const spread = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length) / mean;
      return { corners, spread };
    };
    const s = {};
    for (const t of Vide.VILLAGE_TYPES) s[t.id] = silhouette(t.id);
    assert.ok(s.atelier.corners > s.sanctuaire.corners * 1.5, `carré : ${s.atelier.corners} contre ${s.sanctuaire.corners}`);
    assert.ok(s.bastion.spread < s.jardins.spread / 2, 'un bastion est compact');
    for (const t of ['jardins', 'observatoire']) {
      assert.ok(s[t].spread > s.sanctuaire.spread * 2, `${t} : ${s[t].spread} contre ${s.sanctuaire.spread}`);
    }
  });
})();
