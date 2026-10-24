// Dessin des bâtiments du territoire.
(function (Vide) {
  'use strict';
  const { Render, Structures } = Vide;

  // Formes propres à chaque bâtiment achevé. (x, y) centre, s taille, t temps, f éclat (0 à 1).
  const SHAPES = {
    // Nid : un anneau de petites lumières qui tourne lentement.
    nid(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.light, x, y, s * 2.4, 0.18 + f * 0.3);
      for (let i = 0; i < 7; i++) {
        const a = t * 0.4 + (i / 7) * Math.PI * 2;
        Render.drawGlow(ctx, r.glows.light, x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.75, 6, 0.7 + f * 0.3);
      }
    },

    // Prisme : un triangle aux arêtes fines, dont les sommets se teintent comme un arc-en-ciel.
    prisme(r, x, y, s, t, f) {
      const { ctx } = r;
      const colors = r.prismGlows;
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2, 0.12 + f * 0.4);
      ctx.globalAlpha = 0.45 + f * 0.4;
      ctx.strokeStyle = '#e8f2ff';
      ctx.lineWidth = 1.2 / r.camera.scale;
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = -Math.PI / 2 + t * 0.15 + (i / 3) * Math.PI * 2;
        const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + t * 0.15 + (i / 3) * Math.PI * 2;
        Render.drawGlow(ctx, colors[i], x + Math.cos(a) * s, y + Math.sin(a) * s, 10 + f * 6, 0.8);
      }
    },

    // Phare : un cœur brillant et un faisceau qui balaie lentement le vide.
    phare(r, x, y, s, t, f) {
      const { ctx } = r;
      const a = t * 0.35;
      const length = 260;
      const spread = 0.12;
      const grad = ctx.createLinearGradient(x, y, x + Math.cos(a) * length, y + Math.sin(a) * length);
      grad.addColorStop(0, 'rgba(230, 240, 255, 0.22)');
      grad.addColorStop(1, 'rgba(230, 240, 255, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a - spread) * length, y + Math.sin(a - spread) * length);
      ctx.lineTo(x + Math.cos(a + spread) * length, y + Math.sin(a + spread) * length);
      ctx.closePath();
      ctx.fill();
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2.6, 0.3 + f * 0.3);
      Render.drawGlow(ctx, r.glows.white, x, y, s * 0.7, 1);
    },
  };

  // Chantier : contour en pointillés et arc d'avancement.
  function drawSite(r, b, d, progress, t) {
    const { ctx } = r;
    const s = d.size + 6;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 1 / r.camera.scale;
    ctx.setLineDash([4 / r.camera.scale, 5 / r.camera.scale]);
    ctx.lineDashOffset = -t * 6 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(b.x, b.y, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (progress > 0) {
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(b.x, b.y, s, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }
    // Un halo qui se densifie à mesure que le bâtiment prend forme.
    Render.drawGlow(ctx, r.glows.light, b.x, b.y, d.size * (0.8 + progress), 0.1 + progress * 0.4);
  }

  Vide.Draw.structures = function (r, game) {
    if (!r.prismGlows) {
      r.prismGlows = [r.makeGlow(255, 150, 170), r.makeGlow(150, 255, 190), r.makeGlow(150, 180, 255)];
    }
    const view = Render.viewBounds(r, 300);
    const t = r.time;
    for (const b of game.state.buildings) {
      if (b.x < view.left || b.x > view.right || b.y < view.top || b.y > view.bottom) continue;
      const d = Structures.def(b.type);
      if (Structures.isDone(b)) {
        SHAPES[d.id](r, b.x, b.y, d.size, t, game.colony.flashes.get(b) || 0);
      } else {
        drawSite(r, b, d, b.work / d.work, t);
      }
    }
  };
})(globalThis.Vide);
