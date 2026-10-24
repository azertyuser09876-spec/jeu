// Colosses apaisés : chacun tient un rôle qu'on voit, en plus de son bienfait.
//   Veilleur   défend : il marche vers le danger le plus proche de tes villages (un colosse en marche, sinon des
//              ombres) ; ses pas les écrasent, et il fait plier le colosse qu'il affronte.
//   Tisseuse   tisse : elle parcourt les routes en chantier et y file sa toile ; elles s'achèvent bien plus vite.
//   Léviathan  porte : il rejoint une expédition en route et l'emporte, trois fois plus vite, hors d'atteinte des
//              ombres.
//   Oiseau     accompagne : il tourne au-dessus de ta lumière et révèle les régions autour de lui.
// Rien n'est sauvegardé : le rôle se recalcule à chaque pas (les recherches, deux fois par seconde).
(function (Vide) {
  'use strict';
  const { CONFIG, Territory, Villages, Roads } = Vide;

  const RECHECK = 0.5;

  // --- Veilleur ---

  // Le danger le plus proche d'un village : un colosse en marche, sinon l'ombre la plus proche d'un cœur.
  function threat(game) {
    const marching = game.colossi.find((c) => c.mode === 'march');
    if (marching) return { x: marching.core.x, y: marching.core.y, colossus: marching };
    let best = null;
    let bestD = Infinity;
    for (const v of game.state.villages) {
      const s = Vide.Shadows.nearest(game, v.x, v.y, Territory.radius(v) + 500);
      if (!s) continue;
      const d = Math.hypot(s.x - v.x, s.y - v.y);
      if (d < bestD) {
        bestD = d;
        best = { x: s.x, y: s.y, shadow: s };
      }
    }
    return best;
  }

  function guard(game, c, dt) {
    c.roleCheck = (c.roleCheck || 0) - dt;
    const live = c.threat && (c.threat.colossus ? c.threat.colossus.mode === 'march'
      : c.threat.shadow.hp > 0 && !c.threat.shadow.gone);
    if (c.roleCheck <= 0 || !live) {
      c.roleCheck = RECHECK;
      c.threat = threat(game);
    }
    const t = c.threat;
    if (!t) return null;
    if (t.shadow) {
      // À portée : il lève une patte et l'abat sur elles.
      c.stompCd = (c.stompCd || 0) - dt;
      const s = t.shadow;
      if (c.stompCd <= 0 && Math.hypot(s.x - c.x, s.y - c.y) <= Vide.Colossus.extent(c)) {
        c.stompCd = 1.2;
        const r = Vide.Colossus.FOOT.shadowRadius * Vide.Colossus.reach(c);
        for (const o of game.shadows.list) {
          if (Math.hypot(o.x - s.x, o.y - s.y) <= r) Vide.Shadows.damage(o, Vide.Colossus.FOOT.shadowDamage * 2);
        }
        Vide.Sim.emit(game, 'quake', { points: [{ x: s.x, y: s.y }], radius: r, local: true });
      }
      return { x: s.x, y: s.y, speed: 70 };
    }
    // Face à un colosse en marche : il le fait plier.
    const other = t.colossus;
    const reach = Vide.Colossus.extent(c) + Vide.Colossus.extent(other) * 0.5;
    if (Math.hypot(other.core.x - c.x, other.core.y - c.y) <= reach) {
      if (!c.clash) Vide.Sim.emit(game, 'guardClash', { id: other.id });
      c.clash = true;
      Vide.Colossus.hit(game, other, CONFIG.colossi.guardStagger * dt);
    } else {
      c.clash = false;
    }
    return { x: other.core.x, y: other.core.y, speed: 70 };
  }

  // --- Tisseuse ---

  // La route en chantier qui reste la plus longue à bâtir, et son front (là où le chantier s'arrête).
  function unfinished(state) {
    let best = null;
    let most = 0;
    for (const r of state.roads) {
      const left = Roads.length(state, r) - r.work;
      if (left > most) {
        most = left;
        best = r;
      }
    }
    return best;
  }

  function front(state, road) {
    const [a, b] = Roads.ends(state, road);
    const k = road.work / (Roads.length(state, road) || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  function weave(game, c, dt) {
    const { state } = game;
    c.roleCheck = (c.roleCheck || 0) - dt;
    if (c.roleCheck <= 0 || (c.weaving && !state.roads.includes(c.weaving))) {
      c.roleCheck = RECHECK;
      c.weaving = unfinished(state);
    }
    const road = c.weaving;
    if (!road || Roads.isDone(state, road)) {
      c.weaving = null;
      return null;
    }
    const at = front(state, road);
    if (Math.hypot(at.x - c.x, at.y - c.y) <= 300) {
      road.work = Math.min(Roads.length(state, road), road.work + CONFIG.colossi.weave * dt);
      if (Roads.isDone(state, road)) {
        const [a, b] = Roads.ends(state, road);
        const done = state.roads.filter((x) => Roads.isDone(state, x)).length;
        Vide.Sim.emit(game, 'road', { a: a.type, b: b.type, first: done === 1, woven: true });
        c.weaving = null;
      }
    }
    return { x: at.x, y: at.y, speed: 60 };
  }

  // --- Léviathan ---

  // Une expédition qui marche (ni à l'étude, ni au chantier).
  function walking(state, exp) {
    return state.expeditions.includes(exp)
      && !(exp.kind === 'scholars' && !exp.back && exp.study !== null)
      && !(exp.kind === 'sappers' && !exp.back && exp.site !== null);
  }

  function carry(game, c, dt) {
    const { state } = game;
    if (game.carried && !walking(state, game.carried)) game.carried = null;
    const exp = game.carried;
    if (exp) return { x: exp.x, y: exp.y, speed: 420 };
    c.roleCheck = (c.roleCheck || 0) - dt;
    if (c.roleCheck <= 0) {
      c.roleCheck = RECHECK;
      let best = null;
      let bestD = Infinity;
      for (const e of state.expeditions) {
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (walking(state, e) && d < bestD) {
          bestD = d;
          best = e;
        }
      }
      c.fetching = best;
    }
    const target = c.fetching;
    if (!target || !walking(state, target)) return null;
    if (Math.hypot(target.x - c.x, target.y - c.y) <= 160) {
      game.carried = target;
      Vide.Sim.emit(game, 'carried', { kind: target.kind });
    }
    return { x: target.x, y: target.y, speed: 260 };
  }

  // --- Oiseau d'aube ---

  const SIGHT = 1500; // rayon des régions qu'il révèle

  function escort(game, c, dt) {
    const { state } = game;
    const { player } = state;
    c.roleCheck = (c.roleCheck || 0) - dt;
    if (c.roleCheck <= 0) {
      c.roleCheck = 1;
      const step = Vide.Zones.CELL / 3;
      const found = [];
      for (let dx = -SIGHT; dx <= SIGHT; dx += step) {
        for (let dy = -SIGHT; dy <= SIGHT; dy += step) {
          if (dx * dx + dy * dy > SIGHT * SIGHT) continue;
          const region = Vide.Zones.at(state.seed, c.x + dx, c.y + dy);
          if (Vide.Zones.visit(state, region)) found.push(region.zone.id);
        }
      }
      if (found.length) Vide.Sim.emit(game, 'sighted', { zones: found });
    }
    c.circle = (c.circle || 0) + 0.6 * dt;
    // Loin de toi, il te rejoint à tire-d'aile.
    const far = Math.hypot(player.x - c.x, player.y - c.y) > 2000;
    return { x: player.x + Math.cos(c.circle) * 320, y: player.y + Math.sin(c.circle) * 320, speed: far ? 1400 : 450 };
  }

  const ROLES = { veilleur: guard, tisseuse: weave, leviathan: carry, oiseau: escort };

  // Où va un colosse apaisé, et à quelle vitesse : { x, y, speed }, ou null (il fait sa ronde).
  function spot(game, c, dt) {
    const role = ROLES[c.id];
    return role ? role(game, c, dt) : null;
  }

  // L'expédition que porte le Léviathan (vitesse multipliée, hors d'atteinte des ombres).
  function carried(game, exp) {
    return game.carried === exp;
  }

  Vide.Allies = { ROLES, threat, unfinished, front, walking, spot, carried };
})(globalThis.Vide);
