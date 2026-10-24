// Dessin des nids d'ombre : un voile d'obscurité (dessiné par-dessus le monde, il assombrit vraiment),
// un cœur noir hérissé de pointes et cerné de lueurs violettes, et des flèches sombres sur le bord de l'écran.
(function (Vide) {
  'use strict';
  const { Render, Nests } = Vide;

  let violet = null;

  // Dans le monde (composition « lighter ») : le bord de l'obscurité, un anneau violet très ténu.
  Vide.Draw.nests = function (r, game) {
    const { ctx } = r;
    const view = Render.viewBounds(r, 600);
    for (const nest of game.state.nests) {
      if (nest.x < view.left || nest.x > view.right || nest.y < view.top || nest.y > view.bottom) continue;
      const R = Nests.radius(nest);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#8a60d8';
      ctx.lineWidth = 1.2 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(nest.x, nest.y, R, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  // Par-dessus le monde (composition normale) : l'obscurité, le cœur noir, sa jauge, les flèches sombres.
  Vide.Draw.nestsOverlay = function (r, game) {
    const { ctx, camera } = r;
    const s = camera.scale;
    ctx.globalCompositeOperation = 'source-over';
    for (const nest of game.state.nests) {
      const sx = (nest.x - camera.x) * s + r.width / 2;
      const sy = (nest.y - camera.y) * s + r.height / 2;
      const R = Nests.radius(nest) * s;
      if (sx + R < 0 || sx - R > r.width || sy + R < 0 || sy - R > r.height) {
        if (Math.hypot(nest.x - game.state.player.x, nest.y - game.state.player.y) < 9000) arrow(r, sx, sy);
        continue;
      }
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      grad.addColorStop(0, 'rgba(4, 0, 10, 0.78)');
      grad.addColorStop(0.7, 'rgba(6, 2, 14, 0.55)');
      grad.addColorStop(1, 'rgba(6, 2, 14, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, R, 0, Math.PI * 2);
      ctx.fill();

      // Des lueurs violettes tournent autour du cœur, par-dessus l'obscurité.
      if (!violet) violet = r.makeGlow(150, 90, 230);
      const t0 = r.time + nest.id;
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const a = t0 * 0.25 + (k / 9) * Math.PI * 2;
        const d = (40 + 18 * Math.sin(t0 * 0.7 + k)) * s;
        Render.drawGlow(ctx, violet, sx + Math.cos(a) * d, sy + Math.sin(a) * d, 16 * s, 0.4);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Le cœur : un disque noir aux pointes irrégulières, qui palpite.
      const t = r.time + nest.id;
      const core = (22 + 3 * Math.sin(t * 2.2)) * s;
      ctx.fillStyle = '#020005';
      ctx.strokeStyle = 'rgba(150, 100, 230, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const spikes = 11;
      for (let k = 0; k <= spikes * 2; k++) {
        const a = t * 0.1 + (k / (spikes * 2)) * Math.PI * 2;
        const d = k % 2 ? core * 0.75 : core * (1.3 + 0.25 * Math.sin(k * 1.7 + t));
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

  // Flèche sombre, cernée de violet, sur le bord de l'écran, vers un nid hors de vue.
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
