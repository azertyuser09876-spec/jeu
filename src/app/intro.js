// Éveil : l'animation de lancement, sans un mot. Dans le noir, un point s'allume et vacille, des éclats
// venus de partout convergent vers lui ; puis une onde part et le monde se dévoile pendant que la caméra
// recule. Un clic ou une touche abrège l'attente. Avant l'onde, main.js garde la simulation en pause.
(function (Vide) {
  'use strict';
  const { util } = Vide;

  const GATHER = 2.6;     // fin de la convergence : l'onde part
  const REVEAL = 1.8;     // durée du dévoilement du monde
  const END = GATHER + REVEAL;
  const TITLE_TIME = 4.5; // pour un joueur qui revient, le titre ne reste que quelques secondes
  const STREAKS = 56;

  function create() {
    const streaks = [];
    for (let i = 0; i < STREAKS; i++) {
      streaks.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.55 + Math.random() * 0.6, // départ, en fraction de la demi-diagonale de l'écran
        start: 0.6 + Math.random() * 1.2,
        travel: 0.6 + Math.random() * 0.4,
        width: 0.6 + Math.random() * 0.9,
      });
    }
    return { t: 0, streaks, burst: false, el: document.getElementById('intro') };
  }

  const blocking = (intro) => intro.t < GATHER;
  const done = (intro) => intro.t >= END;

  // Abrège l'attente : l'onde part tout de suite (le dévoilement, court, se joue quand même).
  function skip(intro) {
    if (intro.t < GATHER) intro.t = GATHER;
  }

  function update(intro, state, dt) {
    intro.t += dt;
    if (!intro.burst && intro.t >= GATHER) {
      intro.burst = true;
      Vide.Audio.play('birth');
    }
    document.body.classList.toggle('launching', blocking(intro));
    // Le titre apparaît avec l'onde. Une nouvelle partie le garde jusqu'à la première lumière récoltée.
    const fresh = state.totalLight <= 0;
    const title = intro.t >= GATHER && (fresh || intro.t < GATHER + TITLE_TIME);
    intro.el.classList.toggle('hidden', !title);
    intro.el.classList.toggle('returning', !fresh);
  }

  const revealed = (intro) => util.clamp((intro.t - GATHER) / REVEAL, 0, 1);

  // Facteur de zoom du monde : on part tout près de la lumière, puis la caméra recule.
  function zoom(intro) {
    const k = revealed(intro);
    return 1.9 - 0.9 * (1 - Math.pow(1 - k, 3));
  }

  // À dessiner par-dessus le monde, en coordonnées d'écran ; (sx, sy) : la lumière à l'écran.
  function draw(r, intro, sx, sy) {
    if (done(intro)) return;
    const { ctx } = r;
    const t = intro.t;
    const k = revealed(intro);

    // Le voile noir se lève sur le monde.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - k * k * (3 - 2 * k);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, r.width, r.height);

    ctx.globalCompositeOperation = 'lighter';
    const half = Math.hypot(r.width, r.height) / 2;
    ctx.strokeStyle = '#d6eaff';
    ctx.lineCap = 'round';
    let arrived = 0;
    for (const s of intro.streaks) {
      const p = (t - s.start) / s.travel;
      if (p >= 1) arrived++;
      if (p <= 0 || p >= 1 || t >= GATHER) continue;
      const e = p * p; // ils accélèrent en approchant
      const d = s.dist * half * (1 - e);
      const tail = Math.min(d, 14 + 70 * e);
      const cx = Math.cos(s.angle), cy = Math.sin(s.angle);
      ctx.globalAlpha = Math.min(1, p * 4) * 0.75;
      ctx.lineWidth = s.width * (1 + e);
      ctx.beginPath();
      ctx.moveTo(sx + cx * d, sy + cy * d);
      ctx.lineTo(sx + cx * (d + tail), sy + cy * (d + tail));
      ctx.stroke();
    }

    if (t < GATHER) {
      // Le cœur vacille, puis enfle avec chaque éclat reçu.
      const gathered = arrived / intro.streaks.length;
      const flicker = 0.6 + 0.4 * Math.sin(t * 11) * Math.sin(t * 3.3);
      const on = util.clamp((t - 0.3) / 0.4, 0, 1);
      const alpha = on * (gathered > 0.9 ? 1 : flicker) * (0.45 + 0.55 * gathered);
      Vide.Render.drawGlow(ctx, r.glows.white, sx, sy, 18 + 70 * gathered, alpha);
      Vide.Render.drawGlow(ctx, r.glows.white, sx, sy, 6 + 6 * gathered, on);
    } else {
      // L'onde, et un éclair bref qui s'efface.
      ctx.globalAlpha = 0.6 * (1 - k);
      ctx.lineWidth = 1 + 5 * (1 - k);
      ctx.beginPath();
      ctx.arc(sx, sy, half * 1.1 * (1 - (1 - k) * (1 - k)), 0, Math.PI * 2);
      ctx.stroke();
      Vide.Render.drawGlow(ctx, r.glows.white, sx, sy, 90 + 300 * k, (1 - k) * 0.9);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Vide.Intro = { create, update, skip, blocking, done, zoom, draw };
})(globalThis.Vide);
