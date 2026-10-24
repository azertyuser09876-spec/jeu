// Dessin des enceintes : un double trait de lumière dense, ouvert au bout de chaque avenue par une porte (deux
// bornes qui brillent), troué là où les ombres ont fait une brèche. En chantier : la part montée, un tracé pâle
// pour le reste, et le front qui fait le tour du cœur.
(function (Vide) {
  'use strict';
  const { Render, Walls, Plan, CONFIG } = Vide;

  const TAU = Math.PI * 2;

  // Arcs pleins d'une enceinte : le cercle moins les portes et les brèches, en angles relatifs à l'orientation du
  // village (de 0 à TAU).
  function solidArcs(v, w) {
    const r = Walls.radius(w);
    const cuts = [];
    const g = CONFIG.walls.gate / r;
    const step = TAU / Plan.AVENUES;
    for (let k = 0; k < Plan.AVENUES; k++) {
      const a = k * step;
      if (a - g < 0) cuts.push([a - g + TAU, TAU], [0, a + g]);
      else cuts.push([a - g, a + g]);
    }
    const count = Walls.segments(w);
    for (const s of w.broken) cuts.push([(s / count) * TAU, ((s + 1) / count) * TAU]);
    cuts.sort((a, b) => a[0] - b[0]);
    const arcs = [];
    let at = 0;
    for (const [a, b] of cuts) {
      if (a > at) arcs.push([at, a]);
      at = Math.max(at, b);
    }
    if (at < TAU) arcs.push([at, TAU]);
    return arcs;
  }

  function drawWall(r, game, v, w, t) {
    const { ctx } = r;
    const radius = Walls.radius(w);
    const half = CONFIG.walls.thickness / 2;
    const turn = Plan.turn(v);
    const px = 1 / r.camera.scale;

    if (!Walls.isDone(w)) {
      // Le tracé du chantier, pâle et pointillé ; la part montée, pleine ; le front, une lueur.
      const share = w.work / Walls.workOf(w);
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#dfe8ff';
      ctx.lineWidth = px;
      ctx.setLineDash([4 * px, 8 * px]);
      ctx.beginPath();
      ctx.arc(v.x, v.y, radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      band(ctx, v, radius, half, turn, turn + share * TAU, 0.5, px);
      const f = Walls.front(v, w);
      Render.drawGlow(ctx, r.glows.white, f.x, f.y, 26, 0.5 + 0.2 * Math.sin(t * 6));
      return;
    }

    for (const [a, b] of solidArcs(v, w)) band(ctx, v, radius, half, turn + a, turn + b, 0.62, px);

    // Les pans frappés vacillent ; les brèches gardent quelques gravats.
    const count = Walls.segments(w);
    for (const seg of w.broken) {
      const a = Walls.segmentAngle(v, w, seg);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#a080ff';
      ctx.lineWidth = px;
      ctx.setLineDash([2 * px, 5 * px]);
      ctx.beginPath();
      ctx.arc(v.x, v.y, radius, a - Math.PI / count, a + Math.PI / count);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = -2; i <= 2; i++) {
        const ra = a + (i * Math.PI) / count / 3;
        Render.drawGlow(ctx, r.glows.light, v.x + Math.cos(ra) * (radius + ((i * 7) % 9) - 4), v.y + Math.sin(ra) * (radius + ((i * 5) % 7) - 3), 5, 0.4);
      }
    }
    if (game.wallHp.size) {
      const prefix = `${v.id}:${w.n}:`;
      for (const [k, hp] of game.wallHp) {
        if (!k.startsWith(prefix)) continue;
        const seg = Number(k.slice(prefix.length));
        if (w.broken.includes(seg)) continue;
        const a = Walls.segmentAngle(v, w, seg);
        ctx.globalAlpha = (1 - hp / CONFIG.walls.hp) * (0.4 + 0.3 * Math.sin(t * 20));
        ctx.strokeStyle = '#b090ff';
        ctx.lineWidth = half * 2;
        ctx.beginPath();
        ctx.arc(v.x, v.y, radius, a - Math.PI / count, a + Math.PI / count);
        ctx.stroke();
      }
    }

    // Les portes : deux bornes de chaque côté, qui brillent.
    const g = CONFIG.walls.gate / radius;
    for (let k = 0; k < Plan.AVENUES; k++) {
      const a = turn + (k * TAU) / Plan.AVENUES;
      for (const side of [-1, 1]) {
        const ga = a + side * g;
        const x = v.x + Math.cos(ga) * radius, y = v.y + Math.sin(ga) * radius;
        Render.drawGlow(ctx, r.glows.white, x, y, 14, 0.55);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#f4f8ff';
        ctx.fillRect(x - 2.5 * px * 1.5, y - 2.5 * px * 1.5, 5 * px * 1.5, 5 * px * 1.5);
      }
    }
  }

  // Un arc de muraille : deux traits fins et un voile entre eux.
  function band(ctx, v, radius, half, a0, a1, alpha, px) {
    ctx.globalAlpha = alpha * 0.22;
    ctx.strokeStyle = '#e6eeff';
    ctx.lineWidth = half * 2;
    ctx.beginPath();
    ctx.arc(v.x, v.y, radius, a0, a1);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.2 * px;
    for (const d of [-half, half]) {
      ctx.beginPath();
      ctx.arc(v.x, v.y, radius + d, a0, a1);
      ctx.stroke();
    }
  }

  Vide.Draw = Vide.Draw || {};
  Vide.Draw.walls = function (r, game) {
    const view = Render.viewBounds(r, 40);
    const t = r.time;
    const { ctx } = r;
    ctx.save();
    for (const v of game.state.villages) {
      if (!v.walls.length) continue;
      const far = Walls.radius(v.walls[v.walls.length - 1]) + 40;
      if (v.x + far < view.left || v.x - far > view.right || v.y + far < view.top || v.y - far > view.bottom) continue;
      for (const w of v.walls) drawWall(r, game, v, w, t);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };
})(globalThis.Vide);
