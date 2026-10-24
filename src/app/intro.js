// Éveil : les animations sans un mot qui font naître la lumière.
//   'launch'   au lancement : dans le noir, un point s'allume et vacille, des éclats venus de partout
//              convergent vers lui ; puis une onde part et le monde se dévoile pendant que la caméra recule.
//   'respawn'  quand la lumière est dispersée : elle éclate là où elle est tombée, l'écran s'éteint,
//              puis ses éclats se rassemblent au village le plus proche (ou à l'origine) et le monde revient.
// Un clic ou une touche abrège le lancement. Avant l'onde, main.js garde la simulation en pause.
(function (Vide) {
  'use strict';
  const { util } = Vide;

  // Déroulé de chaque animation (secondes) : éclatement, convergence (début des éclats, onde), dévoilement.
  const KINDS = {
    launch: { scatter: 0, from: 0.6, to: 1.8, gather: 2.6, reveal: 1.8, zoom: 0.9, streaks: 56, cls: 'launching' },
    respawn: { scatter: 0.9, from: 1.0, to: 1.5, gather: 2.2, reveal: 1.0, zoom: 0.45, streaks: 40, cls: 'dispersing' },
  };
  const TITLE_TIME = 4.5; // pour un joueur qui revient, le titre ne reste que quelques secondes
  const SHARDS = 36;

  // `from` : point du monde où la lumière s'est dispersée (réapparition seulement).
  function create(kind, from) {
    const k = KINDS[kind || 'launch'];
    const streaks = [];
    for (let i = 0; i < k.streaks; i++) {
      streaks.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.55 + Math.random() * 0.6, // départ, en fraction de la demi-diagonale de l'écran
        start: k.from + Math.random() * (k.to - k.from),
        travel: (0.6 + Math.random() * 0.4) * (kind === 'respawn' ? 0.7 : 1),
        width: 0.6 + Math.random() * 0.9,
      });
    }
    const shards = [];
    for (let i = 0; i < (k.scatter ? SHARDS : 0); i++) {
      shards.push({ angle: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6, width: 0.6 + Math.random() });
    }
    return {
      kind: kind || 'launch', k, t: 0, streaks, shards, from: from || null, burst: false,
      el: document.getElementById('intro'),
    };
  }

  const blocking = (intro) => intro.t < intro.k.gather;
  const done = (intro) => intro.t >= intro.k.gather + intro.k.reveal;

  // Abrège l'attente du lancement : l'onde part tout de suite (le dévoilement, court, se joue quand même).
  function skip(intro) {
    if (intro.kind === 'launch' && intro.t < intro.k.gather) intro.t = intro.k.gather;
  }

  // Pendant l'éclatement, la caméra reste là où la lumière est tombée.
  function hold(intro) {
    return intro.t < intro.k.scatter ? intro.from : null;
  }

  function update(intro, state, dt) {
    intro.t += dt;
    if (!intro.burst && intro.t >= intro.k.gather) {
      intro.burst = true;
      Vide.Audio.play('birth');
    }
    for (const kind of Object.values(KINDS)) {
      document.body.classList.toggle(kind.cls, kind === intro.k && blocking(intro));
    }
    // Le titre apparaît avec l'onde du lancement. Une nouvelle partie le garde jusqu'à la première lumière.
    const fresh = state.totalLight <= 0;
    const launch = intro.kind === 'launch';
    const title = fresh || (launch && intro.t >= intro.k.gather && intro.t < intro.k.gather + TITLE_TIME);
    intro.el.classList.toggle('hidden', !title || blocking(intro));
    intro.el.classList.toggle('returning', !fresh);
  }

  const revealed = (intro) => util.clamp((intro.t - intro.k.gather) / intro.k.reveal, 0, 1);

  // Facteur de zoom du monde : on part tout près de la lumière, puis la caméra recule.
  function zoom(intro) {
    const k = revealed(intro);
    return 1 + intro.k.zoom * Math.pow(1 - k, 3);
  }

  function drawStreak(ctx, x, y, angle, d, tail, width) {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x + cx * d, y + cy * d);
    ctx.lineTo(x + cx * (d + tail), y + cy * (d + tail));
    ctx.stroke();
  }

  // À dessiner par-dessus le monde, en coordonnées d'écran ; (sx, sy) : la lumière à l'écran.
  function draw(r, intro, sx, sy) {
    if (done(intro)) return;
    const { ctx } = r;
    const { t, k } = intro;
    const reveal = revealed(intro);
    const half = Math.hypot(r.width, r.height) / 2;

    // Le voile : il tombe pendant l'éclatement, puis se lève sur le monde.
    let veil = 1 - reveal * reveal * (3 - 2 * reveal);
    if (t < k.scatter) veil = Math.pow(t / k.scatter, 1.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = veil;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.width, r.height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#d6eaff';
    ctx.lineCap = 'round';

    // Éclatement : la lumière vole en éclats là où elle est tombée.
    if (t < k.scatter && intro.from) {
      const at = Vide.Render.worldToScreen(r, intro.from.x, intro.from.y);
      const p = t / k.scatter;
      const e = 1 - (1 - p) * (1 - p);
      for (const s of intro.shards) {
        ctx.globalAlpha = (1 - p) * 0.85;
        drawStreak(ctx, at.x, at.y, s.angle, 8 + e * s.speed * half * 0.55, 6 + 30 * (1 - p), s.width);
      }
      Vide.Render.drawGlow(ctx, r.glows.white, at.x, at.y, 30 + 120 * e, (1 - p) * 0.8);
    }

    // Convergence : les éclats reviennent de partout vers la lumière.
    let arrived = 0;
    for (const s of intro.streaks) {
      const p = (t - s.start) / s.travel;
      if (p >= 1) arrived++;
      if (p <= 0 || p >= 1 || t >= k.gather) continue;
      const e = p * p; // ils accélèrent en approchant
      const d = s.dist * half * (1 - e);
      ctx.globalAlpha = Math.min(1, p * 4) * 0.75;
      drawStreak(ctx, sx, sy, s.angle, d, Math.min(d, 14 + 70 * e), s.width * (1 + e));
    }

    if (t >= k.scatter && t < k.gather) {
      // Le cœur vacille, puis enfle avec chaque éclat reçu.
      const gathered = arrived / intro.streaks.length;
      const flicker = 0.6 + 0.4 * Math.sin(t * 11) * Math.sin(t * 3.3);
      const on = util.clamp((t - k.scatter - 0.3) / 0.4, 0, 1);
      const alpha = on * (gathered > 0.9 ? 1 : flicker) * (0.45 + 0.55 * gathered);
      Vide.Render.drawGlow(ctx, r.glows.white, sx, sy, 18 + 70 * gathered, alpha);
      Vide.Render.drawGlow(ctx, r.glows.white, sx, sy, 6 + 6 * gathered, on);
    } else if (t >= k.gather) {
      // L'onde, et un éclair bref qui s'efface.
      ctx.globalAlpha = 0.6 * (1 - reveal);
      ctx.lineWidth = 1 + 5 * (1 - reveal);
      ctx.beginPath();
      ctx.arc(sx, sy, half * 1.1 * (1 - (1 - reveal) * (1 - reveal)), 0, Math.PI * 2);
      ctx.stroke();
      Vide.Render.drawGlow(ctx, r.glows.white, sx, sy, 90 + 300 * reveal, (1 - reveal) * 0.9);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Vide.Intro = { create, update, skip, hold, blocking, done, zoom, draw };
})(globalThis.Vide);
