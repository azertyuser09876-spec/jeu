// Dessin des colosses de la 1.8 (corps et attaques), branché sur draw-colossus.js par Vide.Draw.beasts[kind] et
// Vide.Draw.beastAttacks[attaque].
(function (Vide) {
  'use strict';
  const { Render, Colossus } = Vide;
  const { GOLD, LIFT, mix, rgb, glowOf, line, drawEyes } = Vide.Draw.colossusKit;

  function tintOf(c) {
    const t = mix(c.def.tint, GOLD, c.calm);
    return mix(t, [255, 255, 255], c.hitFlash * 0.6);
  }

  // --- L'Oiseau d'aube ---

  // Un oiseau-constellation : un long cou, deux ailes immenses qui battent (repliées au sol), une queue en
  // éventail. En vol, son corps s'élève ; à terre reste son reflet, pâle, à l'endroit qu'il survole.
  function drawBird(r, c) {
    const { ctx } = r;
    const s = c.def.size;
    const px = 1 / r.camera.scale;
    const tint = tintOf(c);
    const glow = glowOf(r, tint);
    const air = c.air || 0;
    const lift = air * LIFT * Colossus.reach(c);
    const local = (lx, ly, up) => {
      const p = Colossus.toWorld(c, lx, ly);
      return { x: p.x, y: p.y - (up === false ? 0 : lift) };
    };
    const flap = Math.sin(c.time * (air > 0.5 ? 3.2 : 0.9));
    const spread = 0.3 + 0.7 * air; // repliées au sol
    const W = c.body.wingspan;

    const wing = (side, up) => {
      const sh = [20, side * 20];
      const el = [-5 + flap * 25, side * (40 + 80 * spread)];
      const tip = [-70 + flap * 50, side * (60 + (W - 60) * spread)];
      return { sh, el, tip, pts: [sh, el, tip].map(([x, y]) => local(x, y, up)) };
    };

    // Le reflet au sol, d'autant plus net qu'il vole bas.
    if (air > 0.05) {
      ctx.globalAlpha = 0.05 + 0.08 * (1 - air);
      for (const side of [-1, 1]) line(ctx, wing(side, false).pts, 10 * s, rgb(tint, 1));
      line(ctx, [local(150, 0, false), local(-150, 0, false)], 8 * s, rgb(tint, 1));
    }

    Render.drawGlow(ctx, glow, c.x, c.y - lift, 300 * s, c.mode === 'kneel' ? 0.22 : 0.12);

    // Les ailes : une membrane translucide, un bras lumineux, et des plumes qui traînent derrière lui.
    for (const side of [-1, 1]) {
      const w = wing(side, true);
      const trail = [];
      for (let f = 7; f >= 0; f--) {
        const t = f / 7;
        const bx = w.el[0] + (w.tip[0] - w.el[0]) * t, by = w.el[1] + (w.tip[1] - w.el[1]) * t;
        trail.push(local(bx - 45 - 25 * t, by + side * 6));
      }
      const membrane = w.pts.concat(trail, [local(-40, side * 18)]);
      ctx.globalAlpha = c.mode === 'kneel' ? 0.16 : 0.1;
      ctx.fillStyle = rgb(tint, 1);
      ctx.beginPath();
      membrane.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.1;
      line(ctx, w.pts, 14 * s, rgb(tint, 1));
      ctx.globalAlpha = 0.6;
      line(ctx, w.pts, 3 * px * 1.3, rgb(tint, 1));
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = rgb(tint, 1);
      ctx.lineWidth = 1.2 * px;
      for (let f = 0; f <= 7; f++) {
        const t = f / 7;
        const bx = w.el[0] + (w.tip[0] - w.el[0]) * t, by = w.el[1] + (w.tip[1] - w.el[1]) * t;
        const a = local(bx, by), b = local(bx - 45 - 25 * t, by + side * 6);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      Render.drawGlow(ctx, glow, w.pts[1].x, w.pts[1].y, 16 * s, 0.6);
      Render.drawGlow(ctx, glow, w.pts[2].x, w.pts[2].y, 22 * s, 0.7);
    }

    // Le corps : cou, poitrine, dos, et la queue en éventail.
    const spine = [[150, 0], [110, 0], [60, 0], [10, 0], [-50, 0], [-100, 0]].map(([x, y]) => local(x, y));
    ctx.globalAlpha = 0.12;
    line(ctx, spine, 18 * s, rgb(tint, 1));
    ctx.globalAlpha = 0.6;
    line(ctx, spine, 2.5 * px, rgb(tint, 1));
    spine.forEach((p) => Render.drawGlow(ctx, glow, p.x, p.y, 14 * s, 0.7));
    for (const y of [-34, -16, 0, 16, 34]) {
      ctx.globalAlpha = 0.35;
      line(ctx, [local(-100, 0), local(-170, y * (1 + 0.15 * flap))], 1.4 * px, rgb(tint, 1));
    }
    const head = local(150, 0);
    Render.drawGlow(ctx, glow, head.x, head.y, 40 * s, 0.6);
    drawEyes(r, c, (x, y) => local(x, y));
  }

  // --- La Méduse ---

  // Vue d'en haut : une cloche ronde aux côtes rayonnantes, au bord festonné, qui se contracte et s'ouvre ;
  // ouverte, elle s'illumine. Ses tentacules traînent derrière elle.
  function drawMedusa(r, c, game) {
    const { ctx } = r;
    const s = c.def.size;
    const px = 1 / r.camera.scale;
    const tint = tintOf(c);
    const glow = glowOf(r, tint);
    const B = c.body;
    const M = Vide.Beasts.medusa;
    const open = M.isOpen(c);
    const e = c.beat * c.beat * (3 - 2 * c.beat);
    const R = B.bell * s * (0.74 + 0.26 * e);

    // Tentacules : des fils perlés.
    for (const chain of c.tentacles) {
      ctx.globalAlpha = 0.45;
      line(ctx, chain, 1.6 * px, rgb(tint, 1));
      ctx.globalAlpha = 0.08;
      line(ctx, chain, 8 * s, rgb(tint, 1));
      chain.forEach((p, k) => { if (k % 3 === 2) Render.drawGlow(ctx, glow, p.x, p.y, 8 * s, 0.5); });
    }

    Render.drawGlow(ctx, glow, c.x, c.y, 280 * s, open ? 0.2 : 0.1);
    // La cloche.
    ctx.globalAlpha = open ? 0.2 : 0.1;
    ctx.fillStyle = rgb(tint, 1);
    ctx.beginPath();
    for (let a = 0; a <= 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      const scallop = 1 + 0.05 * Math.cos(ang * 12);
      const x = c.x + Math.cos(ang) * R * scallop, y = c.y + Math.sin(ang) * R * scallop;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = open ? 0.75 : 0.4;
    ctx.strokeStyle = rgb(tint, 1);
    ctx.lineWidth = 1.5 * px;
    ctx.stroke();
    // Côtes rayonnantes et cœur.
    ctx.globalAlpha = open ? 0.5 : 0.25;
    ctx.lineWidth = 1.2 * px;
    for (let k = 0; k < 12; k++) {
      const ang = c.angle + (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(ang) * R * 0.18, c.y + Math.sin(ang) * R * 0.18);
      ctx.lineTo(c.x + Math.cos(ang) * R * 0.95, c.y + Math.sin(ang) * R * 0.95);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, R * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    Render.drawGlow(ctx, glow, c.x, c.y, R * (open ? 0.9 : 0.5), open ? 0.85 : 0.45);
  }

  // --- Attaques ---

  function band(ctx, from, dir, length, width, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(from.x + Math.cos(dir) * length, from.y + Math.sin(dir) * length);
    ctx.stroke();
  }

  function cone(ctx, atk, length, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(atk.origin.x, atk.origin.y);
    ctx.arc(atk.origin.x, atk.origin.y, length, atk.dir - atk.spread, atk.dir + atk.spread);
    ctx.closePath();
    ctx.fill();
  }

  function circles(r, atk, k) {
    const { ctx } = r;
    for (const p of atk.points) {
      ctx.globalAlpha = 0.12 + 0.25 * k;
      ctx.fillStyle = '#6b3fd1';
      ctx.beginPath();
      ctx.arc(p.x, p.y, atk.radius * (0.25 + 0.75 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#d6c2ff';
      ctx.lineWidth = 1.5 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(p.x, p.y, atk.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  Vide.Draw.beasts = { bird: drawBird, medusa: drawMedusa };

  Vide.Draw.beastAttacks = {
    // Piqué : le couloir qu'il va raser.
    dive(r, c, atk, k) {
      const w = Colossus.ATTACKS.dive.width * c.def.size * 2;
      band(r.ctx, atk.origin, atk.dir, atk.length, w, atk.phase === 'active' ? 0.12 : 0.06 + 0.25 * k, '#6b3fd1');
    },
    // Rafale : un cône qui se charge, puis des traits de vent.
    gale(r, c, atk, k) {
      const { ctx } = r;
      if (atk.phase === 'telegraph') {
        cone(ctx, atk, atk.length * (0.3 + 0.7 * k), 0.06 + 0.2 * k, '#6b3fd1');
        return;
      }
      cone(ctx, atk, atk.length, 0.12, '#e9dcff');
      ctx.strokeStyle = '#f2ecff';
      ctx.lineWidth = 1.5 / r.camera.scale;
      for (let i = 0; i < 9; i++) {
        const a = atk.dir + (i / 8 - 0.5) * 2 * atk.spread * 0.9;
        const d0 = ((atk.t * 1400 + i * 97) % atk.length);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(atk.origin.x + Math.cos(a) * d0, atk.origin.y + Math.sin(a) * d0);
        ctx.lineTo(atk.origin.x + Math.cos(a) * (d0 + 90), atk.origin.y + Math.sin(a) * (d0 + 90));
        ctx.stroke();
      }
    },
    feathers: (r, c, atk, k) => circles(r, atk, k),
    // Fouet : trois lignes qui s'épaississent, puis claquent.
    lash(r, c, atk, k) {
      const w = Colossus.ATTACKS.lash.width * 2;
      for (const l of atk.lines) {
        const dir = Math.atan2(l.b.y - l.a.y, l.b.x - l.a.x);
        const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
        band(r.ctx, l.a, dir, len, atk.phase === 'active' ? w : w * (0.2 + 0.8 * k),
          atk.phase === 'active' ? 0.45 : 0.08 + 0.25 * k, atk.phase === 'active' ? '#ffd9f0' : '#6b3fd1');
      }
    },
  };
})(globalThis.Vide);
