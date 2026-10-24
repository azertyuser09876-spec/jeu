// Dessin du monde sur le canvas. Ne modifie jamais l'état du jeu.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  // Halo lumineux pré-dessiné une fois, puis copié : bien plus rapide qu'un dégradé par particule.
  function makeGlow(r, g, b) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.25, `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    g2.fillStyle = grad;
    g2.fillRect(0, 0, size, size);
    return c;
  }

  function create(canvas) {
    const r = {
      canvas,
      ctx: canvas.getContext('2d'),
      width: 0,
      height: 0,
      dpr: 1,
      camera: { x: 0, y: 0, scale: 1 },
      glows: {
        white: makeGlow(255, 255, 255),
        light: makeGlow(214, 234, 255),
        rare: makeGlow(255, 214, 140),
      },
    };
    resize(r);
    return r;
  }

  function resize(r) {
    r.dpr = Math.min(window.devicePixelRatio || 1, 2);
    r.width = window.innerWidth;
    r.height = window.innerHeight;
    r.canvas.width = Math.round(r.width * r.dpr);
    r.canvas.height = Math.round(r.height * r.dpr);
    r.camera.scale = Math.min(r.width, r.height) / CONFIG.viewSize;
  }

  function screenToWorld(r, sx, sy) {
    const cam = r.camera;
    return {
      x: cam.x + (sx - r.width / 2) / cam.scale,
      y: cam.y + (sy - r.height / 2) / cam.scale,
    };
  }

  function drawGlow(ctx, glow, x, y, radius, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow, x - radius, y - radius, radius * 2, radius * 2);
  }

  // Rectangle visible en coordonnées du monde, avec une marge pour les halos.
  function viewBounds(r, margin) {
    const cam = r.camera;
    const hw = r.width / 2 / cam.scale + margin;
    const hh = r.height / 2 / cam.scale + margin;
    return { left: cam.x - hw, right: cam.x + hw, top: cam.y - hh, bottom: cam.y + hh };
  }

  function drawParticles(r, game) {
    const { ctx } = r;
    const fadeIn = Vide.CONFIG.field.fadeIn;
    const b = viewBounds(r, 30);
    const t = game.time;
    for (const p of game.field.particles) {
      if (p.x < b.left || p.x > b.right || p.y < b.top || p.y > b.bottom) continue;
      const appear = Math.min(1, p.age / fadeIn);
      const twinkle = 0.75 + Math.sin(t * 2.3 + p.phase) * 0.25;
      const caught = p.caught >= 0 ? 1.3 : 1;
      if (p.rare) {
        drawGlow(ctx, r.glows.rare, p.x, p.y, 16 * caught, appear * twinkle);
      } else {
        drawGlow(ctx, r.glows.light, p.x, p.y, 9 * caught, appear * twinkle * 0.9);
      }
    }
  }

  function drawReach(r, game) {
    const { ctx } = r;
    const { x, y } = game.state.player;
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(x, y, game.stats.reach, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPlayer(r, game) {
    const { ctx } = r;
    const { x, y } = game.state.player;
    // Légère respiration du halo pour que la lumière paraisse vivante même à l'arrêt,
    // et éclat bref à chaque récolte.
    const breath = 1 + Math.sin(game.time * 1.6) * 0.06;
    const glow = game.glow;
    drawGlow(ctx, r.glows.white, x, y, 46 * breath * (1 + glow * 0.35), 0.55 + glow * 0.3);
    drawGlow(ctx, r.glows.white, x, y, 14, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, Vide.CONFIG.player.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function followCamera(r, game, dt) {
    const k = Vide.util.damp(5, dt);
    r.camera.x += (game.state.player.x - r.camera.x) * k;
    r.camera.y += (game.state.player.y - r.camera.y) * k;
  }

  // À appeler une fois au démarrage pour ne pas voir la caméra glisser depuis l'origine.
  function snapCamera(r, game) {
    r.camera.x = game.state.player.x;
    r.camera.y = game.state.player.y;
  }

  function draw(r, game, dt) {
    const { ctx, camera } = r;
    followCamera(r, game, dt);
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.width, r.height);

    // Passage en coordonnées du monde, centrées sur la caméra.
    ctx.translate(r.width / 2, r.height / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    ctx.globalCompositeOperation = 'lighter';

    drawReach(r, game);
    drawParticles(r, game);
    drawPlayer(r, game);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Vide.Render = { create, resize, screenToWorld, snapCamera, draw };
})(globalThis.Vide);
