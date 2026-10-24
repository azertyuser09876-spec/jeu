// Dessin des routes de lumière entre villages : le tracé prévu en pointillés, la partie bâtie qui avance
// depuis chaque cœur (le long des avenues, puis la grande route entre les portes), et, sur une route achevée, de
// petites lueurs qui la parcourent ; les caravanes en suivent le tracé.
(function (Vide) {
  'use strict';
  const { Render, Roads } = Vide;

  function polyline(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  // Les deux bords d'un tracé, à `w` de part et d'autre (segment par segment).
  function edges(ctx, points, w) {
    ctx.beginPath();
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-6) continue;
      const nx = (-(b.y - a.y) / len) * w, ny = ((b.x - a.x) / len) * w;
      for (const k of [-1, 1]) {
        ctx.moveTo(a.x + nx * k, a.y + ny * k);
        ctx.lineTo(b.x + nx * k, b.y + ny * k);
      }
    }
    ctx.stroke();
  }

  Vide.Draw.roads = function (r, game) {
    const { ctx } = r;
    const { state } = game;
    const s = r.camera.scale;
    ctx.lineJoin = 'round';
    for (const road of state.roads) {
      const [a, b] = Roads.ends(state, road);
      if (!a || !b) continue;
      const path = Roads.route(state, a, b);
      const len = Roads.pathLength(path) || 1;
      const half = Math.min(0.5, road.work / (Roads.length(state, road) || 1) / 2); // chaque bout bâtit sa moitié
      const done = half >= 0.5;

      if (!done) {
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = '#ffeacc';
        ctx.lineWidth = 1 / s;
        ctx.setLineDash([6 / s, 10 / s]);
        polyline(ctx, Roads.slice(path, half, 1 - half));
        ctx.setLineDash([]);
      }
      for (const [from, to] of [[0, half], [1 - half, 1]]) {
        if (to <= from) continue;
        const part = Roads.slice(path, from, to);
        // Une grande route : un large voile, ses deux bords, et des marques au milieu.
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#fff1d8';
        ctx.lineWidth = 26;
        polyline(ctx, part);
        ctx.globalAlpha = done ? 0.05 : 0.03;
        ctx.lineWidth = 12;
        polyline(ctx, part);
        ctx.globalAlpha = done ? 0.34 : 0.24;
        ctx.lineWidth = 1.2 / s;
        edges(ctx, part, 6.5);
        ctx.globalAlpha = done ? 0.22 : 0.15;
        ctx.lineWidth = 1 / s;
        ctx.setLineDash([10, 14]);
        polyline(ctx, part);
        ctx.setLineDash([]);
      }
      if (done) {
        // Des lueurs qui vont et viennent, chacune sur sa voie, régulièrement espacées.
        const n = Math.max(2, Math.floor(len / 260));
        for (let k = 0; k < n; k++) {
          const p = (r.time * 60 / len + k / n) % 1;
          const q = k % 2 ? p : 1 - p;
          const at = Roads.along(path, q);
          Render.drawGlow(ctx, r.glows.light, at.x, at.y, 7, 0.35);
        }
      }
    }
    // Les troncs communs (plusieurs routes sortent par la même porte) : une route plus large, dont les routes
    // qu'elle porte deviennent les voies.
    for (const trunk of Roads.trunks(state)) {
      const n = trunk.roads.filter((road) => Roads.isDone(state, road)).length;
      if (n < 2) continue;
      const w = 6.5 + 5 * (n - 1);
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = '#fff1d8';
      ctx.lineWidth = w * 2 + 14;
      polyline(ctx, trunk.points);
      ctx.globalAlpha = 0.05;
      ctx.lineWidth = w * 2;
      polyline(ctx, trunk.points);
      ctx.globalAlpha = 0.36;
      ctx.lineWidth = 1.4 / s;
      edges(ctx, trunk.points, w);
    }
    drawCaravans(r, game);
    drawExpeditions(r, game);
    ctx.globalAlpha = 1;
  };

  // Expéditions : un petit groupe de lumières qui marche vers son but ; l'escorte entoure le groupe d'anneaux.
  // Arrêtée par un combat, elle vacille.
  function drawExpeditions(r, game) {
    const { ctx } = r;
    for (const e of game.state.expeditions) {
      const fighting = game.expeditionsFighting.has(e);
      const glow = e.kind === 'colons' ? glowOfType(r, e.type) : e.kind === 'scholars' ? scholarGlow(r) : r.glows.white;
      const n = (e.members.lueur || 0) + (e.members.eclaireur || 0) + (e.members.erudit || 0) + (e.members.batisseur || 0);
      const flicker = fighting ? 0.6 + 0.4 * Math.abs(Math.sin(r.time * 20)) : 1;
      for (let k = 0; k < n; k++) {
        const a = r.time * 1.3 + (k / n) * Math.PI * 2;
        Render.drawGlow(ctx, glow, e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9, 10, 0.8 * flicker);
      }
      for (let k = 0; k < (e.members.gardien || 0); k++) {
        const a = -r.time * 0.9 + (k / e.members.gardien) * Math.PI * 2;
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#ffecaa';
        ctx.lineWidth = 1.2 / r.camera.scale;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * 22, e.y + Math.sin(a) * 22, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Le but, discret, tant qu'on n'y est pas.
      const g = Vide.Expeditions.goal(game.state, e);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / r.camera.scale;
      ctx.setLineDash([4 / r.camera.scale, 8 / r.camera.scale]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Les érudits : une lueur bleu pâle, la couleur du savoir.
  let scholarHalo = null;
  function scholarGlow(r) {
    if (!scholarHalo) scholarHalo = r.makeGlow(170, 200, 255);
    return scholarHalo;
  }

  const typeGlows = {};
  function glowOfType(r, type) {
    if (!typeGlows[type]) {
      const c = Vide.Villages.type(type).tint;
      typeGlows[type] = r.makeGlow(c[0], c[1], c[2]);
    }
    return typeGlows[type];
  }

  // Caravanes : un ballot de lumière qui glisse le long de la route, teinté par ce qu'il porte.
  const tints = {};
  function glowOf(r, kind) {
    if (!tints[kind]) {
      const res = Vide.RESOURCES.find((x) => x.id === kind);
      const c = res ? res.color : Vide.Colony.species('gardien').color;
      tints[kind] = r.makeGlow(c[0], c[1], c[2]);
    }
    return tints[kind];
  }

  function drawCaravans(r, game) {
    const { ctx } = r;
    for (const c of game.trade.caravans) {
      // Un convoi : quelques chariots à la file sur le tracé (un seul pour des soldats), qui vacillent s'il est frappé.
      const path = Roads.route(game.state, c.from, c.to);
      const len = Roads.pathLength(path) || 1;
      const k = c.t / c.duration;
      const wagons = c.kind === 'soldat' ? 1 : 3;
      const flicker = c.flash > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(r.time * 30)) : 1;
      c.flash = Math.max(0, (c.flash || 0) - 1 / 30);
      for (let w = 0; w < wagons; w++) {
        const at = Roads.along(path, Math.max(0, k - (w * 22) / len));
        const bob = Math.sin(r.time * 5 + c.duration + w) * 2;
        Render.drawGlow(ctx, glowOf(r, c.kind), at.x, at.y + bob, w ? 13 : 18, 0.55 * flicker);
        Render.drawGlow(ctx, glowOf(r, c.kind), at.x, at.y + bob, w ? 4.5 : 6, flicker);
      }
      const { x, y } = Roads.along(path, k);
      const bob = Math.sin(r.time * 5 + c.duration) * 2;
      if (c.hp < c.maxHp) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffe7b0';
        ctx.lineWidth = 1.5 / r.camera.scale;
        ctx.beginPath();
        ctx.arc(x, y + bob, 14, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, c.hp) / c.maxHp) * Math.PI * 2);
        ctx.stroke();
      }
      if (c.kind === 'soldat') {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffecaa';
        ctx.lineWidth = 1.2 / r.camera.scale;
        ctx.beginPath();
        ctx.arc(x, y + bob, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
})(globalThis.Vide);
