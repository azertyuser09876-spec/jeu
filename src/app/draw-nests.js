// Dessin des bases des ombres. Dans le monde : un liseré violet au bord de leur noirceur. Par-dessus le monde
// (elle assombrit vraiment) : la noirceur en cinq nuances empilées, jusqu'au noir presque pur au cœur ; les remparts
// d'ombre ; les ouvrages (fosses, flèches) ; les traits sombres des flèches ; le cœur noir hérissé de pointes et
// cerné de lueurs violettes ; des flèches sur le bord de l'écran vers les bases hors de vue.
(function (Vide) {
  'use strict';
  const { Render, Nests, Territory, Walls, CONFIG } = Vide;

  let violet = null;

  // Sur le noir du vide, la noirceur se voit à son voile violet sombre, qui s'épaissit à chaque nuance (dans le
  // monde, en lumière ajoutée) ; par-dessus, elle éteint ce qui s'y trouve (particules, lueurs), et sa dernière
  // nuance est un noir presque pur, cerné de violet.
  const HAZE = 0.07;
  const NUANCE_HAZE = [0.03, 0.04, 0.05, 0.06, 0];
  const BASE_DARK = 0.22;
  const NUANCE_DARK = [0.06, 0.08, 0.1, 0.12, 0.75];

  // Formes d'une base (contour, nuances), recalculées quand ses cellules changent (au plus 4 fois par seconde).
  const shapes = new WeakMap();
  function shapeOf(r, nest) {
    let sum = 0;
    for (let k = 2; k < nest.cells.length; k += 3) sum += nest.cells[k];
    const sig = nest.cells.length * 1e7 + sum;
    const known = shapes.get(nest);
    if (known && (known.sig === sig || r.time - known.at < 0.25)) return known;
    const loops = Territory.outline(nest);
    let extent = 0;
    for (const loop of loops) for (const [x, y] of loop) extent = Math.max(extent, Math.hypot(x - nest.x, y - nest.y));
    const shape = {
      sig, at: r.time, extent,
      area: Vide.Draw.outlinePath(loops),
      nuances: Territory.NUANCES.map((w) => Vide.Draw.outlinePath(Territory.outline(nest, w))),
    };
    shapes.set(nest, shape);
    return shape;
  }

  // Dans le monde (composition « lighter ») : le bord de la noirceur, un liseré violet ténu.
  Vide.Draw.nests = function (r, game) {
    const { ctx } = r;
    const view = Render.viewBounds(r, 600);
    for (const nest of game.state.nests) {
      if (!nest.cells.length) continue;
      const shape = shapeOf(r, nest);
      const R = shape.extent;
      if (nest.x + R < view.left || nest.x - R > view.right || nest.y + R < view.top || nest.y - R > view.bottom) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(70, 35, 125, ${HAZE})`;
      ctx.fill(shape.area, 'evenodd');
      NUANCE_HAZE.forEach((a, n) => {
        if (!a) return;
        ctx.fillStyle = `rgba(70, 35, 125, ${a})`;
        ctx.fill(shape.nuances[n], 'evenodd');
      });
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#8a60d8';
      ctx.lineWidth = 1.2 / r.camera.scale;
      ctx.stroke(shape.area);
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 10 / r.camera.scale;
      ctx.stroke(shape.area);
      // Un halo violet sous chaque ouvrage.
      if (!violet) violet = r.makeGlow(150, 90, 230);
      for (const b of nest.buildings) Render.drawGlow(ctx, violet, b.x, b.y, Vide.darkWork(b.type).size * 3, 0.35);
    }
  };

  // Un rempart d'ombre : une bande noire, bordée de deux traits violets ; ses brèches s'ouvrent.
  function drawWall(ctx, r, nest, w) {
    const radius = Walls.radius(w);
    const s = r.camera.scale;
    const half = CONFIG.walls.thickness / 2;
    const count = Walls.segments(w);
    const share = Walls.isDone(w) ? 1 : w.work / Walls.workOf(w);
    const turn = Vide.Plan.turn(nest);
    for (let seg = 0; seg < count; seg++) {
      if (w.broken.includes(seg)) continue;
      const a0 = turn + (seg / count) * Math.PI * 2;
      if ((seg + 1) / count > share + 1e-9) {
        // Pas encore monté : un tracé pointillé.
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = 'rgba(140, 100, 220, 0.6)';
        ctx.lineWidth = 1 / s;
        ctx.setLineDash([3 / s, 6 / s]);
        ctx.beginPath();
        ctx.arc(nest.x, nest.y, radius, a0, a0 + (Math.PI * 2) / count);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const a1 = a0 + (Math.PI * 2) / count - 0.004;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#030008';
      ctx.lineWidth = half * 2;
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, radius, a0, a1);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#9a70e8';
      ctx.lineWidth = 1.1 / s;
      for (const d of [-half, half]) {
        ctx.beginPath();
        ctx.arc(nest.x, nest.y, radius + d, a0, a1);
        ctx.stroke();
      }
    }
  }

  // Les ouvrages : une fosse (un puits noir où tourne un anneau violet), une flèche (une pointe noire au bout violet).
  function drawWork(ctx, r, b, t) {
    const d = Vide.darkWork(b.type);
    const s = d.size;
    if (b.type === 'fosse') {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#020006';
      ctx.beginPath();
      ctx.arc(b.x, b.y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#8f63e0';
      ctx.lineWidth = 1.2 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(b.x, b.y, s * 0.65, t * 1.4, t * 1.4 + Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, s, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#020006';
      ctx.strokeStyle = 'rgba(160, 110, 240, 0.7)';
      ctx.lineWidth = 1.1 / r.camera.scale;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - s * 1.6);
      ctx.lineTo(b.x + s * 0.55, b.y + s * 0.6);
      ctx.lineTo(b.x - s * 0.55, b.y + s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Sa solidité, quand on l'a frappé.
    if (b.hp < d.hp) {
      const w = s * 2.4;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(b.x - w / 2, b.y + s * 1.4, w, 2.5 / r.camera.scale);
      ctx.fillStyle = 'rgba(190, 150, 255, 0.85)';
      ctx.fillRect(b.x - w / 2, b.y + s * 1.4, (w * Math.max(0, b.hp)) / d.hp, 2.5 / r.camera.scale);
    }
  }

  // Traits des flèches : brefs, violets, qui s'éteignent.
  const bolts = [];

  // Par-dessus le monde (composition normale) : la noirceur, les remparts, les ouvrages, le cœur, les flèches.
  Vide.Draw.nestsOverlay = function (r, game) {
    const { ctx, camera } = r;
    const s = camera.scale;
    ctx.globalCompositeOperation = 'source-over';
    if (!violet) violet = r.makeGlow(150, 90, 230);
    for (const e of game.events) if (e.type === 'darkBolt') bolts.push({ ...e, life: 0.35 });

    // Dans le monde.
    ctx.save();
    ctx.translate(r.width / 2, r.height / 2);
    ctx.scale(s, s);
    ctx.translate(-camera.x, -camera.y);
    const view = Render.viewBounds(r, 200);
    const t = r.time;
    for (const nest of game.state.nests) {
      if (!nest.cells.length) continue;
      const shape = shapeOf(r, nest);
      const R = shape.extent;
      if (nest.x + R < view.left || nest.x - R > view.right || nest.y + R < view.top || nest.y - R > view.bottom) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(4, 0, 10, ${BASE_DARK})`;
      ctx.fill(shape.area, 'evenodd');
      NUANCE_DARK.forEach((a, n) => {
        ctx.fillStyle = `rgba(3, 0, 8, ${a})`;
        ctx.fill(shape.nuances[n], 'evenodd');
      });
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#9a6cf0';
      ctx.lineWidth = 1.3 / s;
      ctx.stroke(shape.nuances[4]);
      for (const w of nest.walls) drawWall(ctx, r, nest, w);
      for (const b of nest.buildings) drawWork(ctx, r, b, t + nest.id);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= 1 / 60;
      if (b.life <= 0) {
        bolts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = b.life / 0.35;
      ctx.strokeStyle = '#b48cff';
      ctx.lineWidth = 2 / s;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.tx, b.ty);
      ctx.stroke();
      Render.drawGlow(ctx, violet, b.tx, b.ty, 18, b.life / 0.35);
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // À l'écran : le cœur, ses lueurs, sa jauge ; les flèches vers les bases hors de vue.
    for (const nest of game.state.nests) {
      const sx = (nest.x - camera.x) * s + r.width / 2;
      const sy = (nest.y - camera.y) * s + r.height / 2;
      const R = Nests.radius(nest) * s;
      if (sx + R < 0 || sx - R > r.width || sy + R < 0 || sy - R > r.height) {
        if (Math.hypot(nest.x - game.state.player.x, nest.y - game.state.player.y) < 9000) arrow(r, sx, sy);
        continue;
      }
      // Des lueurs violettes tournent autour du cœur, par-dessus l'obscurité.
      const t0 = r.time + nest.id;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const a = t0 * 0.25 + (k / 9) * Math.PI * 2;
        const d = (40 + 18 * Math.sin(t0 * 0.7 + k)) * s;
        Render.drawGlow(ctx, violet, sx + Math.cos(a) * d, sy + Math.sin(a) * d, 16 * s, 0.4);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Le cœur : un disque noir aux pointes irrégulières, qui palpite.
      const core = (22 + 3 * Math.sin(t0 * 2.2)) * s;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#020005';
      ctx.strokeStyle = 'rgba(150, 100, 230, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const spikes = 11;
      for (let k = 0; k <= spikes * 2; k++) {
        const a = t0 * 0.1 + (k / (spikes * 2)) * Math.PI * 2;
        const d = k % 2 ? core * 0.75 : core * (1.3 + 0.25 * Math.sin(k * 1.7 + t0));
        if (k === 0) ctx.moveTo(sx + Math.cos(a) * d, sy + Math.sin(a) * d);
        else ctx.lineTo(sx + Math.cos(a) * d, sy + Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sa solidité, quand on l'a blessé.
      const max = Nests.maxHp(nest);
      if (nest.hp < max) {
        const w = 60;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(sx - w / 2, sy + core * 1.8, w, 3);
        ctx.fillStyle = 'rgba(190, 150, 255, 0.85)';
        ctx.fillRect(sx - w / 2, sy + core * 1.8, (w * Math.max(0, nest.hp)) / max, 3);
      }
    }
  };

  // Flèche sombre, cernée de violet, sur le bord de l'écran, vers une base hors de vue.
  function arrow(r, sx, sy) {
    const { ctx } = r;
    const cx = r.width / 2, cy = r.height / 2;
    const dx = sx - cx, dy = sy - cy;
    const inset = 30;
    const k = Math.min((cx - inset) / Math.abs(dx || 1e-9), (cy - inset) / Math.abs(dy || 1e-9));
    ctx.save();
    ctx.translate(cx + dx * k, cy + dy * k);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#05010c';
    ctx.strokeStyle = 'rgba(160, 110, 240, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
})(globalThis.Vide);
