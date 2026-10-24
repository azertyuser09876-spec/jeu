// Dessin des villages (territoire de lumière, cœur) et de l'origine, où naît la lumière.
(function (Vide) {
  'use strict';
  const { Render, Territory, Villages, util } = Vide;

  const MOTE_CELL = 80;

  // Teinte du territoire : le bleu pâle de la lumière, nuancé par le type du village.
  function mix(tint, k) {
    const base = [150, 190, 255];
    return base.map((c, i) => Math.round(c + (tint[i] - c) * k)).join(',');
  }

  // Lissage de Chaikin : coupe chaque coin, trois fois, pour un bord organique au lieu des marches de la grille.
  function smooth(loop, passes) {
    let pts = loop;
    for (let p = 0; p < passes; p++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      pts = out;
    }
    return pts;
  }

  function toPath(loops) {
    const path = new Path2D();
    for (const loop of loops) {
      const pts = smooth(loop, 3);
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
      path.closePath();
    }
    return path;
  }

  // Éclat de chaque nuance du blanc (elles s'additionnent : le blanc pur cumule les cinq).
  const NUANCE_ALPHA = [0.035, 0.05, 0.07, 0.1, 0.22];

  // Formes d'un village (contour, blanc), recalculées quand ses cellules changent (au plus 4 fois par seconde).
  const shapes = new WeakMap();

  function shapeOf(r, v) {
    let sum = 0;
    for (let k = 2; k < v.cells.length; k += 3) sum += v.cells[k];
    const sig = v.cells.length * 1e7 + sum;
    const known = shapes.get(v);
    if (known && (known.sig === sig || r.time - known.at < 0.25)) return known;
    const loops = Territory.outline(v);
    let extent = 0;
    for (const loop of loops) for (const [x, y] of loop) extent = Math.max(extent, Math.hypot(x - v.x, y - v.y));
    const shape = {
      sig,
      at: r.time,
      extent,
      area: toPath(loops),
      // Les cinq nuances du blanc, de la plus pâle au blanc pur.
      nuances: Territory.NUANCES.map((w) => toPath(Territory.outline(v, w))),
    };
    shapes.set(v, shape);
    return shape;
  }

  function drawArea(r, v) {
    const { ctx } = r;
    const tint = Villages.type(v.type).tint;
    const shape = shapeOf(r, v);
    const extent = Math.max(60, shape.extent);

    const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, extent);
    grad.addColorStop(0, `rgba(${mix(tint, 0.4)}, 0.11)`);
    grad.addColorStop(0.6, `rgba(${mix(tint, 0.3)}, 0.05)`);
    grad.addColorStop(1, `rgba(${mix(tint, 0.4)}, 0.10)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fill(shape.area, 'evenodd');

    // Le blanc : là où le territoire a mûri, la lumière perd sa teinte, nuance après nuance (elles s'empilent),
    // jusqu'au blanc pur au cœur, cerné d'un liseré net.
    NUANCE_ALPHA.forEach((a, n) => {
      ctx.fillStyle = `rgba(240, 245, 255, ${a})`;
      ctx.fill(shape.nuances[n], 'evenodd');
    });
    ctx.strokeStyle = 'rgba(245, 248, 255, 0.06)';
    ctx.lineWidth = 6 / r.camera.scale;
    ctx.stroke(shape.nuances[1]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.4 / r.camera.scale;
    ctx.stroke(shape.nuances[4]);

    ctx.strokeStyle = `rgba(${mix(tint, 0.25)}, 0.05)`;
    ctx.lineWidth = 12 / r.camera.scale;
    ctx.stroke(shape.area);
    if (v.extra && v.extra.length) {
      // Une cité : un bord net et dense, comme un rempart de lumière.
      ctx.strokeStyle = `rgba(${mix(tint, 0.25)}, 0.16)`;
      ctx.lineWidth = 5 / r.camera.scale;
      ctx.stroke(shape.area);
    }
    ctx.strokeStyle = `rgba(${mix(tint, 0.25)}, 0.24)`;
    ctx.lineWidth = 1.2 / r.camera.scale;
    ctx.stroke(shape.area);
  }

  // Petites lueurs qui dérivent dans le territoire, générées par cellules (stables, sans état).
  function drawMotes(r, v, seed) {
    const { ctx } = r;
    const b = Render.viewBounds(r, 20);
    const radius = Math.max(60, shapeOf(r, v).extent);
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
        if (!Territory.contains(v, x, y)) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.3 + phase);
        Render.drawGlow(ctx, r.glows.light, x, y, 7, 0.12 + twinkle * 0.18);
      }
    }
  }

  // Le cœur d'un village : rayonnant ; chaque dépôt des êtres le fait briller un instant.
  // Rongé par les ombres, il vacille.
  function polygon(ctx, x, y, radius, sides, turn) {
    ctx.beginPath();
    for (let k = 0; k <= sides; k++) {
      const a = turn + (k / sides) * Math.PI * 2;
      if (k === 0) ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
      else ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    ctx.stroke();
  }

  // Ornement du cœur, propre à chaque type de village : quelques traits de lumière fins, qui vivent lentement.
  // (b : respiration de 0 à 1 ; t : temps.)
  const HEARTS = {
    // Une fleur : six pétales qui tournent et s'ouvrent doucement.
    jardins(ctx, x, y, t, b) {
      for (let k = 0; k < 6; k++) {
        const a = t * 0.06 + (k * Math.PI) / 3;
        const d = 17 + b * 3;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 13 + b * 2, 5.5, a, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    // Des remparts : deux octogones, et une tourelle à chaque angle.
    bastion(ctx, x, y, t, b) {
      const turn = Math.PI / 8;
      polygon(ctx, x, y, 34, 8, turn);
      polygon(ctx, x, y, 22 + b * 2, 8, turn);
      for (let k = 0; k < 8; k++) {
        const a = turn + (k * Math.PI) / 4;
        ctx.strokeRect(x + Math.cos(a) * 34 - 2.5, y + Math.sin(a) * 34 - 2.5, 5, 5);
      }
    },
    // Un engrenage qui tourne, autour d'un carré.
    atelier(ctx, x, y, t) {
      const teeth = 12;
      const turn = t * 0.25;
      ctx.beginPath();
      for (let k = 0; k < teeth * 2; k++) {
        const a0 = turn + (k / (teeth * 2)) * Math.PI * 2;
        const a1 = turn + ((k + 1) / (teeth * 2)) * Math.PI * 2;
        const rad = k % 2 ? 26 : 31;
        ctx.lineTo(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad);
        ctx.lineTo(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad);
      }
      ctx.closePath();
      ctx.stroke();
      polygon(ctx, x, y, 14, 4, -turn * 0.5 + Math.PI / 4);
    },
    // Des arcs qui tournent à des vitesses différentes, et deux astres en orbite.
    observatoire(ctx, x, y, t) {
      for (let k = 0; k < 3; k++) {
        const rad = 18 + k * 11;
        const a = t * (0.3 - k * 0.12) + k * 2;
        ctx.beginPath();
        ctx.arc(x, y, rad, a, a + Math.PI * (1.1 - k * 0.2));
        ctx.stroke();
      }
      for (let k = 0; k < 2; k++) {
        const a = t * (0.5 + k * 0.3) + k * Math.PI;
        const rad = 29 + k * 11;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    // Des ondes qui s'éloignent du cœur, sans fin.
    sanctuaire(ctx, x, y, t) {
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.stroke();
      const alpha = ctx.globalAlpha;
      for (let k = 0; k < 3; k++) {
        const p = (((t * 0.25 + k / 3) % 1) + 1) % 1; // toujours entre 0 et 1, même si t est négatif
        ctx.globalAlpha = alpha * (1 - p);
        ctx.beginPath();
        ctx.arc(x, y, 20 + p * 34, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    },
  };

  function drawHeart(r, v, pulse, hurt) {
    const { ctx } = r;
    const breath = 0.5 + Math.sin(r.time * 0.7 + v.id) * 0.5;
    const flicker = hurt > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(r.time * 25)) : 1;
    Render.drawGlow(ctx, r.glows.white, v.x, v.y, 150 + pulse * 40, (0.22 + breath * 0.06 + pulse * 0.2) * flicker);
    Render.drawGlow(ctx, r.glows.light, v.x, v.y, 40 + pulse * 10, 0.75 * flicker);
    ctx.globalAlpha = (0.32 + breath * 0.1 + pulse * 0.3) * flicker;
    ctx.strokeStyle = `rgb(${mix(Villages.type(v.type).tint, 0.6)})`;
    ctx.lineWidth = 1 / r.camera.scale;
    HEARTS[v.type](ctx, v.x, v.y, r.time + v.id * 7, breath);
    if (v.extra && v.extra.length) {
      // Une cité : un anneau de plus, autant de points que de spécialités.
      ctx.beginPath();
      ctx.arc(v.x, v.y, 52, 0, Math.PI * 2);
      ctx.stroke();
      [v.type, ...v.extra].forEach((t, k, all) => {
        const a = r.time * 0.05 + (k / all.length) * Math.PI * 2;
        ctx.strokeStyle = `rgb(${mix(Villages.type(t).tint, 0.7)})`;
        ctx.beginPath();
        ctx.arc(v.x + Math.cos(a) * 52, v.y + Math.sin(a) * 52, 3, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  // Les quartiers d'une cité (anciens cœurs) : plus petits, reliés au cœur par une avenue de lumière.
  function drawDistricts(r, v) {
    const { ctx } = r;
    const s = r.camera.scale;
    for (const d of v.districts || []) {
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#eef4ff';
      ctx.lineWidth = 10 / s;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1 / s;
      ctx.stroke();
      Render.drawGlow(ctx, r.glows.white, d.x, d.y, 80, 0.14);
      Render.drawGlow(ctx, r.glows.light, d.x, d.y, 22, 0.6);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(0.6, 0.6);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = `rgb(${mix(Villages.type(d.type).tint, 0.6)})`;
      ctx.lineWidth = 1 / (s * 0.6);
      HEARTS[d.type](ctx, 0, 0, r.time + Math.abs(d.x % 97), 0.5);
      ctx.restore();
    }
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
      const radius = Math.max(60, shapeOf(r, v).extent);
      if (v.x + radius < view.left || v.x - radius > view.right || v.y + radius < view.top || v.y - radius > view.bottom) continue;
      drawArea(r, v);
      drawMotes(r, v, state.seed + v.id * 31);
      drawDistricts(r, v);
      drawHeart(r, v, game.colony.glows.get(v) || 0, game.heartHurt.get(v) || 0);
    }
  };
})(globalThis.Vide);
