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

    // Signes distinctifs de l'armée : un bouclier pour le gardien, des pointes pour l'étincelle,
    // un halo doux pour la veilleuse.
    if (sp.role === 'guard') {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = `rgb(${sp.color.join(',')})`;
      ctx.lineWidth = 1.5 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
    } else if (sp.role === 'ranged') {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = `rgb(${sp.color.join(',')})`;
      ctx.lineWidth = 1 / r.camera.scale;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + b.phase + (i * Math.PI) / 2;
        ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      }
      ctx.stroke();
    } else if (sp.role === 'healer') {
      Render.drawGlow(ctx, glow, x, y, 34 * birth, 0.25 + 0.15 * Math.sin(t * 3 + b.phase));
    }
    // Blessure : l'être pâlit un instant.
    if (b.hurt > 0) Render.setGlowScale(1 - b.hurt * 0.6);

    Render.drawGlow(ctx, glow, x, y, (24 + b.flash * 12) * birth, 0.75 + b.flash * 0.25);
    Render.drawGlow(ctx, glow, x, y, 9 * birth, 1);
    Render.drawGlow(ctx, r.glows.white, x, y, 4 * birth, 0.9);
    Render.setGlowScale(1);

    // Bâtisseur au travail : des étincelles jaillissent vers le chantier.
    if (b.working && b.site) {
      for (let i = 0; i < 2; i++) {
        const k = (t * 2.3 + b.phase + i * 0.5) % 1;
        const sx = x + (b.site.x - x) * k + Math.sin(t * 13 + i) * 3;
        const sy = y + (b.site.y - y) * k + Math.cos(t * 11 + i) * 3;
        Render.drawGlow(ctx, glow, sx, sy, 5, 0.9 * (1 - k));
      }
    }

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
      if (being.down > 0) continue; // éteint : il se rallumera au cœur de son village
      drawBeing(r, being, Vide.Colony.species(being.species), t);
    }
  };
})(globalThis.Vide);
