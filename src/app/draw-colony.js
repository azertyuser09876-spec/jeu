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
    const dirX = speed > 1 ? b.vx / speed : Math.cos(b.phase), dirY = speed > 1 ? b.vy / speed : Math.sin(b.phase);
    if (sp.id === 'bouclier') {
      // Un écu large, tourné vers où il va.
      const a = Math.atan2(dirY, dirX);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = `rgb(${sp.color.join(',')})`;
      ctx.lineWidth = 2.4 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(x, y, 14, a - 1.1, a + 1.1);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (sp.id === 'lancier') {
      // Une longue lance de lumière, pointée devant lui.
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = `rgb(${sp.color.join(',')})`;
      ctx.lineWidth = 1.4 / r.camera.scale;
      ctx.beginPath();
      ctx.moveTo(x - dirX * 8, y - dirY * 8);
      ctx.lineTo(x + dirX * 30, y + dirY * 30);
      ctx.stroke();
      Render.drawGlow(ctx, glow, x + dirX * 30, y + dirY * 30, 9, 0.9);
    } else if (sp.role === 'guard') {
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

  // Une foule (des centaines d'êtres à l'écran) : chacun n'est plus qu'un halo et son cœur blanc, réunis d'avance
  // dans une seule image par espèce (un dessin par être).
  const CROWD = 500;
  const crowdSprites = {};
  function crowdSprite(r, sp) {
    if (crowdSprites[sp.id]) return crowdSprites[sp.id];
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.8;
    g.drawImage(glowFor(r, sp), 0, 0, size, size);
    g.globalAlpha = 0.9;
    const core = size * (4 / 20);
    g.drawImage(r.glows.white, size / 2 - core, size / 2 - core, core * 2, core * 2);
    crowdSprites[sp.id] = c;
    return c;
  }
  function drawSimple(r, b, sp) {
    Render.drawGlow(r.ctx, crowdSprite(r, sp), b.x, b.y, 20 * Math.min(1, b.age / 1.2), 1);
  }

  Vide.Draw.colony = function (r, game) {
    const b = Render.viewBounds(r, 40);
    const t = r.time;
    const seen = [];
    for (const being of game.colony.beings) {
      if (being.x < b.left || being.x > b.right || being.y < b.top || being.y > b.bottom) continue;
      if (being.down > 0) continue; // éteint : il se rallumera au cœur de son village
      seen.push(being);
    }
    const crowd = seen.length > CROWD;
    for (const being of seen) {
      const sp = Vide.Colony.species(being.species);
      if (crowd) drawSimple(r, being, sp);
      else drawBeing(r, being, sp, t);
    }
  };
})(globalThis.Vide);
