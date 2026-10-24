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

  function draw(r) {
    const { ctx, camera } = r;
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

    drawGlow(ctx, r.glows.white, 0, 0, 40, 1);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Vide.Render = { create, resize, screenToWorld, draw };
})(globalThis.Vide);
