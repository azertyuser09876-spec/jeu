// Dessin du foyer et du territoire de lumière.
(function (Vide) {
  'use strict';
  const { Render, Territory, util } = Vide;

  const EDGE_POINTS = 140;
  const MOTE_CELL = 80;

  // Rayon du bord à l'angle a : légère ondulation lente pour un contour organique.
  function edge(radius, a, t) {
    return radius * (1 + 0.016 * Math.sin(5 * a + t * 0.15) + 0.007 * Math.sin(11 * a - t * 0.1));
  }

  function drawArea(r, radius) {
    const { ctx } = r;
    const t = r.time;
    ctx.beginPath();
    for (let i = 0; i <= EDGE_POINTS; i++) {
      const a = (i / EDGE_POINTS) * Math.PI * 2;
      const d = edge(radius, a, t);
      if (i === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
      else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.04);
    grad.addColorStop(0, 'rgba(150, 190, 255, 0.11)');
    grad.addColorStop(0.6, 'rgba(110, 150, 220, 0.05)');
    grad.addColorStop(1, 'rgba(160, 200, 255, 0.10)');
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
  function drawMotes(r, radius, seed) {
    const { ctx } = r;
    const b = Render.viewBounds(r, 20);
    const r2 = radius * radius;
    const x0 = Math.floor(Math.max(b.left, -radius) / MOTE_CELL);
    const x1 = Math.floor(Math.min(b.right, radius) / MOTE_CELL);
    const y0 = Math.floor(Math.max(b.top, -radius) / MOTE_CELL);
    const y1 = Math.floor(Math.min(b.bottom, radius) / MOTE_CELL);
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
        if (x * x + y * y > r2) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + phase);
        Render.drawGlow(ctx, r.glows.light, x, y, 7, 0.12 + twinkle * 0.18);
      }
    }
  }

  // Le foyer : faible et vacillant tant qu'il n'est pas allumé, rayonnant ensuite.
  function drawFoyer(r, lit, pulse) {
    const { ctx } = r;
    const breath = 0.5 + Math.sin(r.time * 0.7) * 0.5;
    if (lit) {
      // Chaque dépôt des êtres fait briller le foyer un instant.
      Render.drawGlow(ctx, r.glows.white, 0, 0, 150 + pulse * 40, 0.22 + breath * 0.06 + pulse * 0.2);
      Render.drawGlow(ctx, r.glows.light, 0, 0, 40 + pulse * 10, 0.75);
      ctx.globalAlpha = 0.25 + breath * 0.1;
    } else {
      Render.drawGlow(ctx, r.glows.white, 0, 0, 90, 0.07 + breath * 0.03);
      ctx.globalAlpha = 0.1 + breath * 0.05;
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + breath * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  Vide.Draw.territory = function (r, game) {
    const { state } = game;
    if (state.territory.lit) {
      const radius = Territory.radius(state);
      drawArea(r, radius);
      drawMotes(r, radius, state.seed);
    }
    drawFoyer(r, state.territory.lit, game.colony.foyerGlow);
  };
})(globalThis.Vide);
