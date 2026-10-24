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
      fog: 0,      // brouillard affiché, qui suit en douceur celui de la zone
      zoom: Vide.util.clamp(Number(Vide.Settings.get('zoom', 1)) || 1, ZOOM_MIN, ZOOM_MAX),
      autoZoom: 1,
      lean: { x: 0, y: 0 }, // la caméra se décale vers un colosse proche
      introZoom: 1, // rapprochement de l'animation de lancement
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
    r.baseScale = Math.sqrt((r.width * r.height) / CONFIG.viewArea);
    r.camera.scale = r.baseScale * r.zoom * r.autoZoom * r.introZoom;
  }

  // Par défaut, les secousses suivent la préférence du système (« réduire les animations »).
  const REDUCE_DEFAULT = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Zoom choisi par le joueur (molette, pincement, + / −), gardé dans les réglages.
  const ZOOM_MIN = 0.55;
  const ZOOM_MAX = 1.8;

  function zoomBy(r, factor) {
    if (factor === 1) return;
    r.zoom = Vide.util.clamp(r.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    Vide.Settings.set('zoom', r.zoom);
  }

  // Recul automatique quand un colosse sauvage approche : on doit voir la créature (presque) entière, et soi
  // tout petit à côté d'elle.
  function updateZoom(r, game, dt) {
    let target = 1;
    const lean = { x: 0, y: 0 };
    const { player } = game.state;
    // Demi-côté le plus court de l'écran, en unités du monde, sans recul.
    const half = Math.min(r.width, r.height) / 2 / (r.baseScale * r.zoom);
    for (const c of game.colossi) {
      if (c.mode === 'resident' || c.mode === 'home') continue;
      const e = Vide.Colossus.extent(c);
      const dx = c.core.x - player.x, dy = c.core.y - player.y;
      const d = Math.hypot(dx, dy);
      const near = Vide.util.clamp((e * 2 + 1400 - d) / 900, 0, 1);
      const fit = Vide.util.clamp(half / (e + 0.45 * Math.min(d, e * 2)), 0.42, 1);
      const zoom = 1 - (1 - fit) * near;
      if (zoom >= target) continue;
      target = zoom;
      // On regarde aussi vers lui, sans jamais perdre la lumière de vue (au plus 55 % du demi-écran).
      const max = (0.55 * half) / zoom;
      const k = Math.min(0.4 * near, d ? max / d : 0);
      lean.x = dx * k;
      lean.y = dy * k;
    }
    r.autoZoom += (target - r.autoZoom) * Vide.util.damp(1.2, dt);
    r.lean.x += (lean.x - r.lean.x) * Vide.util.damp(1.2, dt);
    r.lean.y += (lean.y - r.lean.y) * Vide.util.damp(1.2, dt);
    r.camera.scale = r.baseScale * r.zoom * r.autoZoom * r.introZoom;
  }

  function worldToScreen(r, wx, wy) {
    const cam = r.camera;
    return { x: (wx - cam.x) * cam.scale + r.width / 2, y: (wy - cam.y) * cam.scale + r.height / 2 };
  }

  function screenToWorld(r, sx, sy) {
    const cam = r.camera;
    return {
      x: cam.x + (sx - r.width / 2) / cam.scale,
      y: cam.y + (sy - r.height / 2) / cam.scale,
    };
  }

  // Échelle de luminosité appliquée à tous les halos (bâtiment éteint, vacillement…).
  let glowScale = 1;
  function setGlowScale(s) {
    glowScale = s;
  }

  function drawGlow(ctx, glow, x, y, radius, alpha) {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha * glowScale));
    ctx.drawImage(glow, x - radius, y - radius, radius * 2, radius * 2);
  }

  // Poussière lointaine, dessinée en coordonnées d'écran. Elle défile plus lentement que le monde
  // (parallaxe) : on sent qu'on avance dans l'immensité. Générée par cellules, donc infinie et stable.
  const DUST_LAYERS = [
    { parallax: 0.15, cell: 90, chance: 0.35, size: 0.8, alpha: 0.18 },
    { parallax: 0.4, cell: 140, chance: 0.4, size: 1.2, alpha: 0.28 },
  ];

  function drawDust(r, seed, tint) {
    const { ctx, camera } = r;
    const s = camera.scale;
    ctx.fillStyle = `rgb(${tint.join(',')})`;
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

  // Quand un point du monde est hors de l'écran, une petite flèche sur le bord indique sa direction.
  // (Coordonnées d'écran : à appeler hors de la transformation du monde.)
  function edgePointer(r, wx, wy, color, alpha) {
    const { ctx, camera } = r;
    const sx = (wx - camera.x) * camera.scale + r.width / 2;
    const sy = (wy - camera.y) * camera.scale + r.height / 2;
    const margin = 30;
    if (sx > -margin && sx < r.width + margin && sy > -margin && sy < r.height + margin) return;

    const cx = r.width / 2, cy = r.height / 2;
    const dx = sx - cx, dy = sy - cy;
    const angle = Math.atan2(dy, dx);
    // Point d'intersection du rayon centre → cible avec le bord de l'écran (moins une marge).
    const inset = 26;
    const tx = (cx - inset) / Math.abs(dx || 1e-9);
    const ty = (cy - inset) / Math.abs(dy || 1e-9);
    const t = Math.min(tx, ty);
    const px = cx + dx * t, py = cy + dy * t;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
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

  // Halo des particules du champ, teinté par la zone traversée.
  function zoneGlow(r, zone) {
    r.zoneGlows = r.zoneGlows || {};
    if (!r.zoneGlows[zone.id]) r.zoneGlows[zone.id] = makeGlow(zone.tint[0], zone.tint[1], zone.tint[2]);
    return r.zoneGlows[zone.id];
  }

  // Brouillard (Brume, Gouffre…) : la vue se resserre autour de la lumière. Il se lève et retombe en douceur.
  function drawFog(r, game, dt) {
    const target = game.region.zone.fog;
    r.fog += (target - r.fog) * Vide.util.damp(0.8, dt);
    if (r.fog < 0.02) return;
    const { ctx, camera } = r;
    const sx = (game.state.player.x - camera.x) * camera.scale + r.width / 2;
    const sy = (game.state.player.y - camera.y) * camera.scale + r.height / 2;
    const visible = (1100 - 820 * r.fog) * camera.scale;
    const grad = ctx.createRadialGradient(sx, sy, visible * 0.35, sx, sy, visible);
    grad.addColorStop(0, 'rgba(6, 8, 12, 0)');
    grad.addColorStop(1, `rgba(6, 8, 12, ${0.96 * r.fog})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r.width, r.height);
  }

  function drawParticles(r, game, list, glowLight) {
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
        drawGlow(ctx, glowLight || r.glows.light, p.x, p.y, 9 * caught, appear * twinkle * 0.9);
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
    // Une animation peut retenir la caméra ailleurs (là où la lumière s'est dispersée).
    // Relâchée, elle rejoint la lumière d'un coup (le monde est alors dans le noir).
    if (r.hold) {
      r.camera.x = r.hold.x;
      r.camera.y = r.hold.y;
      r.held = true;
      return;
    }
    if (r.held) {
      r.held = false;
      snapCamera(r, game);
      return;
    }
    const { player } = game.state;
    const tx = player.x + r.lean.x, ty = player.y + r.lean.y;
    // Un saut lointain (lumière dispersée, renvoyée à un village) : la caméra suit d'un coup.
    if (Math.hypot(tx - r.camera.x, ty - r.camera.y) > 900) snapCamera(r, game);
    const k = Vide.util.damp(5, dt);
    r.camera.x += (tx - r.camera.x) * k;
    r.camera.y += (ty - r.camera.y) * k;
  }

  // À appeler une fois au démarrage pour ne pas voir la caméra glisser depuis l'origine.
  function snapCamera(r, game) {
    r.lean.x = r.lean.y = 0;
    r.camera.x = game.state.player.x;
    r.camera.y = game.state.player.y;
  }

  function draw(r, game, dt) {
    const { ctx, camera } = r;
    r.time += dt;
    updateZoom(r, game, dt);
    followCamera(r, game, dt);
    updateTrail(r, game);
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.width, r.height);

    drawDust(r, game.state.seed, game.region.zone.tint);
    // Une petite flèche indique le village le plus proche (ou l'origine, tant qu'il n'y en a aucun).
    const home = Vide.Villages.nearest(game.state, game.state.player.x, game.state.player.y);
    edgePointer(r, home ? home.x : 0, home ? home.y : 0, '#fff', 0.3);

    // Passage en coordonnées du monde, centrées sur la caméra (secouée par les pas des colosses).
    // Secousses réduites (réglage) : à peine un frisson.
    r.shake = (r.shake || 0) * (1 - Vide.util.damp(6, dt));
    const shake = r.shake * (Vide.Settings.get('reduceShake', REDUCE_DEFAULT) ? 0.15 : 1);
    const shakeX = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(r.width / 2 + shakeX, r.height / 2 + shakeY);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);
    ctx.globalCompositeOperation = 'lighter';

    Vide.Draw.colossiBelow(r, game);
    Vide.Draw.territory(r, game);
    Vide.Draw.nests(r, game);
    Vide.Draw.roads(r, game);
    Vide.Draw.structures(r, game);
    drawReach(r, game);
    drawPulse(r, game);
    drawParticles(r, game, game.garden.particles);
    drawParticles(r, game, game.field.particles, zoneGlow(r, game.region.zone));
    Vide.Draw.engines(r, game, dt);
    Vide.Draw.colossi(r, game, dt);
    Vide.Draw.colony(r, game);
    Vide.Draw.combat(r, game, dt);
    Vide.Draw.abilities(r, game);
    drawTrail(r);
    drawPlayer(r, game);

    // Retour aux coordonnées d'écran pour les effets plein écran.
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    Vide.Draw.nestsOverlay(r, game);
    drawFog(r, game, dt);
    Vide.Draw.colossiOverlay(r, game);
    Vide.Draw.combatOverlay(r, game);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Vide.Render = {
    create, resize, screenToWorld, worldToScreen, snapCamera, draw, drawGlow, setGlowScale, viewBounds, edgePointer, zoomBy,
    REDUCE_DEFAULT,
  };
  // Fonctions de dessin spécialisées (territoire, êtres…), définies dans src/app/draw-*.js.
  Vide.Draw = Vide.Draw || {};
})(globalThis.Vide);
