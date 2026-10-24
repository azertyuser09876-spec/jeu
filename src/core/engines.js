// La relève : des engins de siège bâtis sur place par des sapeurs (des bâtisseurs partis en expédition, voir
// expeditions.js), là où l'on veut attirer un colosse.
//   Baliste  tire de lourds traits sur un colosse en combat à sa portée : ils remplissent sa jauge, il plie plus
//            vite. Sans colosse, elle vise le cœur d'un nid d'ombre à portée.
//   Chaîne   un ancrage : le colosse en combat qui passe à sa portée est entravé (ralenti, sa jauge se remplit,
//            il reste plus longtemps à genou). Elle s'use en le retenant, puis cède.
// Les pas et les séismes des colosses les abîment ; à zéro, ils sont détruits.
// État persistant : state.engines = [{ id, kind, x, y, hp, built }] (built : avancement du chantier, 0 → 1).
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  const KINDS = {
    baliste: { id: 'baliste', name: 'Baliste', hp: 160 },
    chaine: { id: 'chaine', name: 'Chaîne', hp: 30 },
  };

  function def(kind) {
    return KINDS[kind];
  }

  const ready = (e) => e.built >= 1;

  function add(state, kind, x, y, built) {
    const e = {
      id: state.engines.reduce((m, o) => Math.max(m, o.id), 0) + 1,
      kind, x, y, hp: KINDS[kind].hp, built: built === undefined ? 1 : built,
    };
    state.engines.push(e);
    return e;
  }

  function byId(state, id) {
    return state.engines.find((e) => e.id === id) || null;
  }

  function remove(game, e, reason) {
    const list = game.state.engines;
    const i = list.indexOf(e);
    if (i < 0) return;
    list.splice(i, 1);
    Vide.Sim.emit(game, 'engineLost', { kind: e.kind, x: e.x, y: e.y, reason });
  }

  function create(game) {
    game.engines = { reload: new Map(), holding: new Set(), bolts: [] };
  }

  // Colosse en combat le plus proche de (x, y), à `range` de son corps, ou null.
  function foe(game, x, y, range) {
    let best = null;
    let bestD = Infinity;
    for (const c of game.colossi) {
      if (c.mode !== 'hunt' && c.mode !== 'kneel') continue;
      const d = Math.hypot(c.core.x - x, c.core.y - y) - c.core.radius;
      if (d <= range && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function hurt(game, e, amount) {
    e.hp -= amount;
    if (e.hp <= 0) remove(game, e, 'crushed');
  }

  // Les engins à portée d'un pas de colosse sont abîmés.
  function damageAt(game, x, y, radius, amount) {
    for (const e of game.state.engines.slice()) {
      if (Math.hypot(e.x - x, e.y - y) <= radius) hurt(game, e, amount);
    }
  }

  function ballista(game, e, dt) {
    const B = CONFIG.engines.ballista;
    const g = game.engines;
    const left = (g.reload.get(e.id) || 0) - dt;
    if (left > 0) {
      g.reload.set(e.id, left);
      return;
    }
    const c = foe(game, e.x, e.y, B.range);
    let target = null;
    if (c) {
      target = c.core;
      Vide.Colossus.hit(game, c, B.stagger);
    } else {
      const nest = Vide.Nests.nearest(game.state, e.x, e.y, B.range);
      if (nest) {
        target = nest;
        Vide.Nests.hit(game, nest, B.nestDamage);
      }
    }
    if (!target) {
      g.reload.set(e.id, 0.5); // rien à viser : on regarde de nouveau bientôt
      return;
    }
    g.reload.set(e.id, B.reload);
    Vide.Sim.emit(game, 'bolt', { from: { x: e.x, y: e.y }, to: { x: target.x, y: target.y } });
  }

  function chain(game, e, dt) {
    const C = CONFIG.engines.chain;
    const c = foe(game, e.x, e.y, C.range);
    const g = game.engines;
    if (!c) {
      g.holding.delete(e.id);
      return;
    }
    if (!g.holding.has(e.id)) {
      g.holding.add(e.id);
      Vide.Sim.emit(game, 'chained', { id: c.id, x: e.x, y: e.y });
    }
    c.bound = e;
    Vide.Colossus.hit(game, c, C.stagger * dt);
    e.hp -= C.wear * dt;
    if (e.hp <= 0) remove(game, e, 'snapped');
  }

  // Chaque pas : les balistes tirent, les chaînes retiennent (c.bound : la chaîne qui retient ce colosse).
  function update(game, dt) {
    for (const c of game.colossi) c.bound = null;
    for (const e of game.state.engines.slice()) {
      if (!ready(e)) continue;
      if (e.kind === 'baliste') ballista(game, e, dt);
      else chain(game, e, dt);
    }
  }

  Vide.Engines = { KINDS, def, ready, add, byId, create, foe, hurt, damageAt, update };
})(globalThis.Vide);
