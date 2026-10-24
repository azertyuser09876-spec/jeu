// Dessin des capacités : le fanal posé (et la lumière qu'il garde), la traînée d'une ruée,
// l'anneau qui se referme pendant la concentration du Retour.
(function (Vide) {
  'use strict';
  const { Render, Abilities, CONFIG } = Vide;

  function drawBeacon(r, game) {
    const b = game.state.beacon;
    if (!b) return;
    const view = Render.viewBounds(r, 300);
    if (b.x < view.left || b.x > view.right || b.y < view.top || b.y > view.bottom) {
      Render.edgePointer(r, b.x, b.y, '#fff3d6', 0.35);
      return;
    }
    const { ctx } = r;
    const t = r.time;
    const radius = Abilities.beaconRadius(game.stats);
    // Des lueurs qui glissent vers lui depuis le bord de son rayon.
    for (let k = 0; k < 10; k++) {
      const p = (t * 0.35 + k / 10) % 1;
      const a = k * 2.399 + Math.floor(t * 0.35 + k / 10) * 1.3;
      const d = radius * (1 - p);
      Render.drawGlow(ctx, r.glows.light, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 6, 0.5 * Math.min(1, p * 3));
    }
    // Sa réserve : il brille d'autant plus qu'il garde de lumière.
    const full = Math.min(1, Math.log10(1 + b.light) / 5);
    Render.drawGlow(ctx, r.glows.rare, b.x, b.y, 40 + 50 * full, 0.25 + 0.35 * full);
    Render.drawGlow(ctx, r.glows.white, b.x, b.y, 8, 1);
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 1 / r.camera.scale;
    ctx.setLineDash([3 / r.camera.scale, 9 / r.camera.scale]);
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 18);
    ctx.lineTo(b.x, b.y + 18);
    ctx.moveTo(b.x - 6, b.y - 12);
    ctx.lineTo(b.x + 6, b.y - 12);
    ctx.stroke();
  }

  function drawDash(r, game) {
    const a = game.abilities.dash;
    if (a.t <= 0) return;
    const { ctx } = r;
    const { x, y } = game.state.player;
    const k = a.t / CONFIG.abilities.dashTime;
    for (let i = 1; i <= 6; i++) {
      Render.drawGlow(ctx, r.glows.white, x - a.dx * i * 14, y - a.dy * i * 14, 16 - i, 0.45 * k * (1 - i / 7));
    }
  }

  function drawRecall(r, game) {
    const c = game.abilities.recall.channel;
    if (c < 0) return;
    const { ctx } = r;
    const { x, y } = game.state.player;
    const k = 1 - c / CONFIG.abilities.recallChannel;
    ctx.globalAlpha = 0.25 + 0.5 * k;
    ctx.strokeStyle = '#e8f2ff';
    ctx.lineWidth = 1.4 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(x, y, 90 * (1 - k) + 12, 0, Math.PI * 2);
    ctx.stroke();
    Render.drawGlow(ctx, r.glows.white, x, y, 30 + 40 * k, 0.3 * k);
  }

  Vide.Draw.abilities = function (r, game) {
    drawBeacon(r, game);
    drawDash(r, game);
    drawRecall(r, game);
    r.ctx.globalAlpha = 1;
  };
})(globalThis.Vide);
