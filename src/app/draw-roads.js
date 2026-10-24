// Dessin des routes de lumière entre villages : le tracé prévu en pointillés, la partie bâtie qui avance
// depuis chaque cœur, et, sur une route achevée, de petites lueurs qui la parcourent.
(function (Vide) {
  'use strict';
  const { Render, Roads } = Vide;

  function segment(ctx, a, b, from, to) {
    const dx = b.x - a.x, dy = b.y - a.y;
    ctx.beginPath();
    ctx.moveTo(a.x + dx * from, a.y + dy * from);
    ctx.lineTo(a.x + dx * to, a.y + dy * to);
    ctx.stroke();
  }

  Vide.Draw.roads = function (r, game) {
    const { ctx } = r;
    const { state } = game;
    const s = r.camera.scale;
    for (const road of state.roads) {
      const [a, b] = Roads.ends(state, road);
      if (!a || !b) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const half = Math.min(0.5, road.work / len / 2); // chaque bout bâtit sa moitié
      const done = half >= 0.5;

      if (!done) {
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = '#ffeacc';
        ctx.lineWidth = 1 / s;
        ctx.setLineDash([6 / s, 10 / s]);
        segment(ctx, a, b, half, 1 - half);
        ctx.setLineDash([]);
      }
      for (const [from, to] of [[0, half], [1 - half, 1]]) {
        if (to <= from) continue;
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = '#fff1d8';
        ctx.lineWidth = 12 / s;
        segment(ctx, a, b, from, to);
        ctx.globalAlpha = done ? 0.38 : 0.3;
        ctx.lineWidth = 1.4 / s;
        segment(ctx, a, b, from, to);
      }
      if (done) {
        // Des lueurs qui vont et viennent, régulièrement espacées.
        const n = Math.max(2, Math.floor(len / 260));
        for (let k = 0; k < n; k++) {
          const p = (r.time * 60 / len + k / n) % 1;
          const q = k % 2 ? p : 1 - p;
          Render.drawGlow(ctx, r.glows.light, a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, 7, 0.35);
        }
      }
    }
    drawCaravans(r, game);
    ctx.globalAlpha = 1;
  };

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
      const k = Math.min(1, c.t / c.duration);
      const x = c.from.x + (c.to.x - c.from.x) * k, y = c.from.y + (c.to.y - c.from.y) * k;
      const bob = Math.sin(r.time * 5 + c.duration) * 2;
      Render.drawGlow(ctx, glowOf(r, c.kind), x, y + bob, 18, 0.55);
      Render.drawGlow(ctx, glowOf(r, c.kind), x, y + bob, 6, 1);
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
