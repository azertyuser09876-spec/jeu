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
      makeGlow,
      camera: { x: 0, y: 0, scale: 1 },
      trail: [],   // positions récentes de la lumière (purement visuel)
      time: 0,
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
    r.camera.scale = Math.sqrt((r.width * r.height) / CONFIG.viewArea);
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

  // Poussière lointaine, dessinée en coordonnées d'écran. Elle défile plus lentement que le monde
  // (parallaxe) : on sent qu'on avance dans l'immensité. Générée par cellules, donc infinie et stable.
  const DUST_LAYERS = [
    { parallax: 0.15, cell: 90, chance: 0.35, size: 0.8, alpha: 0.18 },
    { parallax: 0.4, cell: 140, chance: 0.4, size: 1.2, alpha: 0.28 },
  ];

  function drawDust(r, seed) {
    const { ctx, camera } = r;
    const s = camera.scale;
    ctx.fillStyle = '#fff';
    DUST_LAYERS.forEach((layer, li) => {
      const ox = camera.x * layer.parallax;
      const oy = camera.y * layer.parallax;
      const hw = r.width / 2 / s;
      const hh = r.height / 2 / s;
      const x0 = Math.floor((ox - hw) / layer.cell), x1 = Math.floor((ox + hw) / layer.cell);
      const y0 = Math.floor((oy - hh) / layer.cell), y1 = Math.floor((oy + hh) / layer.cell);
      const layerSeed = seed + li * 7919;
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          if (Vide.util.hash2(cx, cy, layerSeed) > layer.chance) continue;
          const wx = (cx + Vide.util.hash2(cx, cy, layerSeed + 1)) * layer.cell;
          const wy = (cy + Vide.util.hash2(cx, cy, layerSeed + 2)) * layer.cell;
          const sx = (wx - ox) * s + r.width / 2;
          const sy = (wy - oy) * s + r.height / 2;
          const shade = Vide.util.hash2(cx, cy, layerSeed + 3);
          ctx.globalAlpha = layer.alpha * (0.4 + shade * 0.6);
          const size = layer.size * (0.6 + shade * 0.8);
          ctx.fillRect(sx, sy, size, size);
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  // Quand l'origine est hors de l'écran, une petite flèche sur le bord indique sa direction.
  function drawOriginPointer(r) {
    const { ctx, camera } = r;
    const sx = (0 - camera.x) * camera.scale + r.width / 2;
    const sy = (0 - camera.y) * camera.scale + r.height / 2;
    const margin = 30;
    if (sx > -margin && sx < r.width + margin && sy > -margin && sy < r.height + margin) return;

    const cx = r.width / 2, cy = r.height / 2;
    const dx = sx - cx, dy = sy - cy;
    const angle = Math.atan2(dy, dx);
    // Point d'intersection du rayon centre → origine avec le bord de l'écran (moins une marge).
    const inset = 26;
    const tx = (cx - inset) / Math.abs(dx || 1e-9);
    const ty = (cy - inset) / Math.abs(dy || 1e-9);
    const t = Math.min(tx, ty);
    const px = cx + dx * t, py = cy + dy * t;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(3, 0);
    ctx.lineTo(-5, 6);
    ctx.stroke();
    ctx.restore();
  }

  // Traînée : quelques positions récentes de la lumière, qui s'estompent en ~0,6 s.
  const TRAIL_LIFE = 0.6;

  function updateTrail(r, game) {
    const { x, y } = game.state.player;
    const trail = r.trail;
    const lastPoint = trail[trail.length - 1];
    if (!lastPoint || Math.hypot(x - lastPoint.x, y - lastPoint.y) > 3) trail.push({ x, y, t: r.time });
    while (trail.length && r.time - trail[0].t > TRAIL_LIFE) trail.shift();
  }

  function drawTrail(r) {
    const { ctx } = r;
    for (const p of r.trail) {
      const life = 1 - (r.time - p.t) / TRAIL_LIFE;
      drawGlow(ctx, r.glows.light, p.x, p.y, 6 + life * 6, life * 0.25);
    }
  }

  // Rectangle visible en coordonnées du monde, avec une marge pour les halos.
  function viewBounds(r, margin) {
    const cam = r.camera;
    const hw = r.width / 2 / cam.scale + margin;
    const hh = r.height / 2 / cam.scale + margin;
    return { left: cam.x - hw, right: cam.x + hw, top: cam.y - hh, bottom: cam.y + hh };
  }

  function drawParticles(r, game, list) {
    const { ctx } = r;
    const fadeIn = Vide.CONFIG.field.fadeIn;
    const b = viewBounds(r, 30);
    const t = game.time;
    for (const p of list) {
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

  function drawPulse(r, game) {
    const wave = game.pulse.wave;
    if (wave < 0) return;
    const { ctx } = r;
    const { x, y } = game.state.player;
    const progress = wave / game.stats.pulseRadius;
    ctx.globalAlpha = 0.5 * (1 - progress);
    ctx.strokeStyle = '#d6eaff';
    ctx.lineWidth = (2 + 6 * (1 - progress)) / r.camera.scale;
    ctx.beginPath();
    ctx.arc(x, y, wave, 0, Math.PI * 2);
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
    r.time += dt;
    followCamera(r, game, dt);
    updateTrail(r, game);
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.width, r.height);

    drawDust(r, game.state.seed);
    drawOriginPointer(r);

    // Passage en coordonnées du monde, centrées sur la caméra.
    ctx.translate(r.width / 2, r.height / 2);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    ctx.globalCompositeOperation = 'lighter';

    Vide.Draw.territory(r, game);
    Vide.Draw.structures(r, game);
    drawReach(r, game);
    drawPulse(r, game);
    drawParticles(r, game, game.garden.particles);
    drawParticles(r, game, game.field.particles);
    Vide.Draw.colony(r, game);
    drawTrail(r);
    drawPlayer(r, game);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Vide.Render = { create, resize, screenToWorld, snapCamera, draw, drawGlow, viewBounds };
  // Fonctions de dessin spécialisées (territoire, êtres…), définies dans src/app/draw-*.js.
  Vide.Draw = Vide.Draw || {};
})(globalThis.Vide);
