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

    // Tour de lumière : un losange veillé par un anneau qui tourne.
    tour(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2.4, 0.2 + f * 0.4);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#fff3d6';
      ctx.lineWidth = 1.2 / r.camera.scale;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.6, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.6, y);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x, y, s * 1.4, t * 1.2, t * 1.2 + Math.PI * 1.2);
      ctx.stroke();
      Render.drawGlow(ctx, r.glows.white, x, y, s * 0.6, 1);
    },

    // Phare : un cœur brillant et un faisceau qui balaie lentement le vide.
    // Caserne : un enclos carré, des rangs de soldats (points) et deux fanions qui battent.
    caserne(r, x, y, s, t, f) {
      const { ctx } = r;
      const px = 1 / r.camera.scale;
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2.2, 0.16 + f * 0.4);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#fff3d6';
      ctx.lineWidth = 1.2 * px;
      ctx.strokeRect(x - s, y - s * 0.75, s * 2, s * 1.5);
      ctx.fillStyle = '#fff3d6';
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(x - s * 0.5 + i * s * 0.5, y - s * 0.25 + j * s * 0.5, 1.6 * px + s * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const side of [-1, 1]) {
        const fx = x + side * s, fy = y - s * 0.75;
        const wave = Math.sin(t * 4 + side) * s * 0.15;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - s * 0.9);
        ctx.lineTo(fx + side * s * 0.45, fy - s * 0.75 + wave);
        ctx.lineTo(fx, fy - s * 0.6);
        ctx.stroke();
      }
    },
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

  function line(r, alpha, color, width) {
    const { ctx } = r;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = (width || 1.2) / r.camera.scale;
  }

  Object.assign(SHAPES, {
    // Fontaine : des ronds dans l'eau qui s'élargissent sans fin.
    fontaine(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.light, x, y, s * 2, 0.2 + f * 0.3);
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.35 + k / 3) % 1;
        line(r, (1 - p) * 0.55, '#d6f0ff');
        ctx.beginPath();
        ctx.arc(x, y, s * (0.3 + p * 1.2), 0, Math.PI * 2);
        ctx.stroke();
      }
      Render.drawGlow(ctx, r.glows.light, x, y, 6, 0.9);
    },

    // Source : une goutte de lumière d'où montent de petites bulles.
    source(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.light, x, y, s * 2.2, 0.22 + f * 0.3);
      line(r, 0.55, '#c8ffe8');
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.2, x, y + s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.2, x, y - s);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const p = (t * 0.4 + k / 4) % 1;
        Render.drawGlow(ctx, r.glows.light, x + Math.sin(k * 2.1 + t) * s * 0.4, y - s - p * s * 1.6, 4, (1 - p) * 0.8);
      }
    },

    // Archive : des lignes de mémoire empilées, qui s'allument tour à tour.
    archive(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2, 0.15 + f * 0.3);
      for (let k = 0; k < 5; k++) {
        const lit = 0.25 + 0.5 * Math.max(0, Math.sin(t * 1.2 - k * 0.9));
        line(r, lit, '#fff1d6');
        const yy = y - s * 0.8 + k * s * 0.4;
        const w = s * (0.6 + 0.3 * Math.sin(k * 1.7));
        ctx.beginPath();
        ctx.moveTo(x - w, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
      }
    },

    // Rempart : un arc dense tourné vers le dehors, hérissé de piquets.
    rempart(r, x, y, s, t, f, v) {
      const { ctx } = r;
      const out = v ? Math.atan2(y - v.y, x - v.x) : 0;
      const R = s * 2.6;
      const cx = x - Math.cos(out) * R, cy = y - Math.sin(out) * R; // centre de l'arc, côté cœur
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2.4, 0.14 + f * 0.3);
      line(r, 0.55, '#ffeccc', 2);
      ctx.beginPath();
      ctx.arc(cx, cy, R, out - 0.55, out + 0.55);
      ctx.stroke();
      line(r, 0.3, '#ffeccc', 1);
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, out - 0.5, out + 0.5);
      ctx.stroke();
      for (let k = -2; k <= 2; k++) {
        const a = out + k * 0.24;
        Render.drawGlow(ctx, r.glows.white, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, 0.7);
      }
    },

    // Serre : un hexagone où poussent de petites feuilles de lumière.
    serre(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.light, x, y, s * 2.2, 0.2 + f * 0.3);
      line(r, 0.5, '#c8ffdc');
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI / 6 + (k / 6) * Math.PI * 2;
        if (k === 0) ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        else ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const a = t * 0.2 + (k / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4, s * 0.35, s * 0.15, a, 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    // Citadelle : une tour massive, double losange et anneau lent.
    citadelle(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2.6, 0.24 + f * 0.4);
      line(r, 0.65, '#fff3d6', 1.6);
      for (const k of [1, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(x, y - s * k);
        ctx.lineTo(x + s * k, y);
        ctx.lineTo(x, y + s * k);
        ctx.lineTo(x - s * k, y);
        ctx.closePath();
        ctx.stroke();
      }
      line(r, 0.3, '#fff3d6');
      ctx.beginPath();
      ctx.arc(x, y, s * 1.5, -t * 0.6, -t * 0.6 + Math.PI * 1.5);
      ctx.stroke();
      Render.drawGlow(ctx, r.glows.white, x, y, s * 0.7, 1);
    },

    // Fonderie : un carré au feu doux, d'où jaillissent des étincelles.
    fonderie(r, x, y, s, t, f) {
      const { ctx } = r;
      Render.drawGlow(ctx, r.glows.rare, x, y, s * 2.2, 0.22 + f * 0.3);
      line(r, 0.55, '#ffd2a0');
      ctx.strokeRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4);
      for (let k = 0; k < 5; k++) {
        const p = (t * 0.9 + k / 5) % 1;
        const a = -Math.PI / 2 + Math.sin(k * 3.7) * 0.9;
        Render.drawGlow(ctx, r.glows.rare, x + Math.cos(a) * p * s * 1.8, y + Math.sin(a) * p * s * 1.8, 3.5, (1 - p) * 0.9);
      }
    },

    // Lunette : une longue vue qui balaie lentement le ciel, et sa lentille.
    lunette(r, x, y, s, t, f) {
      const { ctx } = r;
      const a = Math.sin(t * 0.15) * 1.2 - Math.PI / 2;
      Render.drawGlow(ctx, r.glows.light, x, y, s * 2, 0.18 + f * 0.3);
      line(r, 0.55, '#d6e4ff', 1.4);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * s * 0.6, y - Math.sin(a) * s * 0.6);
      ctx.lineTo(x + Math.cos(a) * s * 1.8, y + Math.sin(a) * s * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s * 1.8, y + Math.sin(a) * s * 1.8, s * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    },

    // Autel : un cercle pâle et une colonne de lumière qui monte.
    autel(r, x, y, s, t, f) {
      const { ctx } = r;
      const grad = ctx.createLinearGradient(x, y, x, y - s * 6);
      grad.addColorStop(0, 'rgba(255, 235, 250, 0.35)');
      grad.addColorStop(1, 'rgba(255, 235, 250, 0)');
      ctx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 0.8);
      ctx.fillStyle = grad;
      ctx.fillRect(x - s * 0.3, y - s * 6, s * 0.6, s * 6);
      Render.drawGlow(ctx, r.glows.white, x, y, s * 2.4, 0.2 + f * 0.3);
      line(r, 0.55, '#ffe6f6');
      ctx.beginPath();
      ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      Render.drawGlow(ctx, r.glows.white, x, y, s * 0.5, 1);
    },
  });

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
    if (!r.villageGlows) {
      r.villageGlows = {};
      for (const vt of Vide.VILLAGE_TYPES) r.villageGlows[vt.id] = r.makeGlow(vt.tint[0], vt.tint[1], vt.tint[2]);
    }
    const view = Render.viewBounds(r, 300);
    const t = r.time;
    for (const v of game.state.villages) for (const b of v.buildings) {
      if (b.x < view.left || b.x > view.right || b.y < view.top || b.y > view.bottom) continue;
      const d = Structures.def(b.type);
      // Un halo aux couleurs du village, sous chaque bâtiment : on sait d'un coup d'œil à qui il appartient.
      if (Structures.isDone(b) && !b.broken) Render.drawGlow(r.ctx, r.villageGlows[v.type], b.x, b.y, d.size * 2.6, 0.22);
      if (b.broken) {
        // Éteint par les ombres : presque gris, avec un cerne violet, jusqu'à sa réparation.
        Render.setGlowScale(0.2);
        SHAPES[d.id](r, b.x, b.y, d.size, t, 0, v);
        Render.setGlowScale(1);
        const ctx = r.ctx;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#a080ff';
        ctx.lineWidth = 1 / r.camera.scale;
        ctx.setLineDash([2 / r.camera.scale, 4 / r.camera.scale]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, d.size + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (Structures.isDone(b)) {
        const f = game.colony.flashes.get(b) || 0;
        // Frappé par une ombre (éclat négatif) : il vacille.
        if (f < 0) Render.setGlowScale(0.5 + 0.5 * Math.abs(Math.sin(t * 30)));
        SHAPES[d.id](r, b.x, b.y, d.size, t, Math.max(0, f), v);
        Render.setGlowScale(1);
      } else {
        drawSite(r, b, d, b.work / d.work, t);
      }
    }
  };
})(globalThis.Vide);
