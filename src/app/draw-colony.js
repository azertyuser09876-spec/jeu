// Dessin des êtres de lumière.
(function (Vide) {
  'use strict';
  const { Render } = Vide;

  // Un halo teinté par espèce, créé à la demande.
  const glows = {};
  function glowFor(r, sp) {
    if (!glows[sp.id]) glows[sp.id] = r.makeGlow(sp.color[0], sp.color[1], sp.color[2]);
    return glows[sp.id];
  }

  function drawBeing(r, b, sp, t) {
    const { ctx } = r;
    // Légère ondulation perpendiculaire au mouvement : les êtres « nagent » plutôt qu'ils ne glissent.
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const sway = Math.sin(t * 6 + b.phase) * Math.min(3, speed * 0.05);
    const x = b.x + (-b.vy / speed) * sway;
    const y = b.y + (b.vx / speed) * sway;
    const birth = Math.min(1, b.age / 1.2);
    const glow = glowFor(r, sp);

    // Naissance : un anneau qui s'ouvre autour du nouvel être.
    if (birth < 1) {
      ctx.globalAlpha = (1 - birth) * 0.6;
      ctx.strokeStyle = `rgb(${sp.color.join(',')})`;
      ctx.lineWidth = 1 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(x, y, 6 + birth * 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    Render.drawGlow(ctx, glow, x, y, (24 + b.flash * 12) * birth, 0.75 + b.flash * 0.25);
    Render.drawGlow(ctx, glow, x, y, 9 * birth, 1);
    Render.drawGlow(ctx, r.glows.white, x, y, 4 * birth, 0.9);

    // Charge portée : de petits points qui tournent autour de l'être.
    for (let i = 0; i < b.carry; i++) {
      const a = t * 3 + b.phase + (i / Math.max(b.carry, 1)) * Math.PI * 2;
      Render.drawGlow(ctx, r.glows.light, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 5, 0.8);
    }
  }

  Vide.Draw.colony = function (r, game) {
    const b = Render.viewBounds(r, 40);
    const t = r.time;
    for (const being of game.colony.beings) {
      if (being.x < b.left || being.x > b.right || being.y < b.top || being.y > b.bottom) continue;
      drawBeing(r, being, Vide.Colony.species(being.species), t);
    }
  };
})(globalThis.Vide);
