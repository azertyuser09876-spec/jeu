// Dessin des villages (territoire de lumière, cœur) et de l'origine, où naît la lumière.
(function (Vide) {
  'use strict';
  const { Render, Territory, Villages, util } = Vide;

  const EDGE_POINTS = 140;
  const MOTE_CELL = 80;

  // Rayon du bord à l'angle a : légère ondulation lente pour un contour organique.
  function edge(radius, a, t) {
    return radius * (1 + 0.016 * Math.sin(5 * a + t * 0.15) + 0.007 * Math.sin(11 * a - t * 0.1));
  }

  // Teinte du territoire : le bleu pâle de la lumière, nuancé par le type du village.
  function mix(tint, k) {
    const base = [150, 190, 255];
    return base.map((c, i) => Math.round(c + (tint[i] - c) * k)).join(',');
  }

  function drawArea(r, v) {
    const { ctx } = r;
    const t = r.time;
    const radius = Territory.radius(v);
    const tint = Villages.type(v.type).tint;
    ctx.beginPath();
    for (let i = 0; i <= EDGE_POINTS; i++) {
      const a = (i / EDGE_POINTS) * Math.PI * 2;
      const d = edge(radius, a, t + v.id * 10);
      if (i === 0) ctx.moveTo(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d);
      else ctx.lineTo(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, radius * 1.04);
    grad.addColorStop(0, `rgba(${mix(tint, 0.4)}, 0.11)`);
    grad.addColorStop(0.6, `rgba(${mix(tint, 0.3)}, 0.05)`);
    grad.addColorStop(1, `rgba(${mix(tint, 0.4)}, 0.10)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(200, 225, 255, 0.05)';
    ctx.lineWidth = 12 / r.camera.scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210, 230, 255, 0.24)';
    ctx.lineWidth = 1.2 / r.camera.scale;
    ctx.stroke();
  }

  // Petites lueurs qui dérivent dans le territoire, générées par cellules (stables, sans état).
  function drawMotes(r, v, seed) {
    const { ctx } = r;
    const b = Render.viewBounds(r, 20);
    const radius = Territory.radius(v);
    const r2 = radius * radius;
    const x0 = Math.floor(Math.max(b.left, v.x - radius) / MOTE_CELL);
    const x1 = Math.floor(Math.min(b.right, v.x + radius) / MOTE_CELL);
    const y0 = Math.floor(Math.max(b.top, v.y - radius) / MOTE_CELL);
    const y1 = Math.floor(Math.min(b.bottom, v.y + radius) / MOTE_CELL);
    const t = r.time;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const h = util.hash2(cx, cy, seed + 101);
        if (h > 0.3) continue;
        const phase = h * 40;
        const bx = (cx + util.hash2(cx, cy, seed + 102)) * MOTE_CELL;
        const by = (cy + util.hash2(cx, cy, seed + 103)) * MOTE_CELL;
        const x = bx + Math.cos(t * 0.3 + phase) * 12;
        const y = by + Math.sin(t * 0.23 + phase) * 12;
        if ((x - v.x) ** 2 + (y - v.y) ** 2 > r2) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + phase);
        Render.drawGlow(ctx, r.glows.light, x, y, 7, 0.12 + twinkle * 0.18);
      }
    }
  }

  // Le cœur d'un village : rayonnant ; chaque dépôt des êtres le fait briller un instant.
  // Rongé par les ombres, il vacille.
  function drawHeart(r, v, pulse, hurt) {
    const { ctx } = r;
    const breath = 0.5 + Math.sin(r.time * 0.7 + v.id) * 0.5;
    const flicker = hurt > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(r.time * 25)) : 1;
    Render.drawGlow(ctx, r.glows.white, v.x, v.y, 150 + pulse * 40, (0.22 + breath * 0.06 + pulse * 0.2) * flicker);
    Render.drawGlow(ctx, r.glows.light, v.x, v.y, 40 + pulse * 10, 0.75 * flicker);
    ctx.globalAlpha = 0.25 + breath * 0.1;
    ctx.strokeStyle = `rgb(${mix(Villages.type(v.type).tint, 0.5)})`;
    ctx.lineWidth = 1 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 26 + breath * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // L'origine, où naît la lumière : un simple anneau qui respire faiblement.
  function drawOrigin(r) {
    const { ctx } = r;
    const breath = 0.5 + Math.sin(r.time * 0.7) * 0.5;
    Render.drawGlow(ctx, r.glows.white, 0, 0, 90, 0.07 + breath * 0.03);
    ctx.globalAlpha = 0.1 + breath * 0.05;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + breath * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  Vide.Draw.territory = function (r, game) {
    const { state } = game;
    const view = Render.viewBounds(r, 200);
    drawOrigin(r);
    for (const v of state.villages) {
      const radius = Territory.radius(v);
      if (v.x + radius < view.left || v.x - radius > view.right || v.y + radius < view.top || v.y - radius > view.bottom) continue;
      drawArea(r, v);
      drawMotes(r, v, state.seed + v.id * 31);
      drawHeart(r, v, game.colony.glows.get(v) || 0, game.heartHurt.get(v) || 0);
    }
  };
})(globalThis.Vide);
