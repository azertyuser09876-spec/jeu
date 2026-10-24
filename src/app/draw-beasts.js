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

  // --- La Nuée ---

  // Des centaines d'éclats, chacun un trait bref le long de sa course ; au cœur, quatre noyaux.
  function drawSwarm(r, c) {
    const { ctx } = r;
    const s = c.def.size;
    const px = 1 / r.camera.scale;
    const tint = tintOf(c);
    const glow = glowOf(r, tint);
    const tame = c.mode === 'calm' || c.mode === 'home' || c.mode === 'resident';
    Render.drawGlow(ctx, glow, c.x, c.y, c.body.cloud * s * 1.3, c.mode === 'kneel' || tame ? 0.05 : 0.1);
    ctx.globalAlpha = tame ? 0.4 : 0.75;
    ctx.strokeStyle = rgb(tint, 1);
    ctx.lineWidth = 1.8 * px;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const f of c.shards) {
      const v = Math.hypot(f.vx, f.vy) || 1;
      const len = Math.max(5, Math.min(26, v * 0.04));
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x - (f.vx / v) * len, f.y - (f.vy / v) * len);
    }
    ctx.stroke();
    for (let i = 0; i < c.shards.length; i += 5) Render.drawGlow(ctx, glow, c.shards[i].x, c.shards[i].y, 9 * s, 0.4);
    c.nuclei.forEach((n, k) => {
      const broken = c.seals[k] && c.seals[k].broken;
      Render.drawGlow(ctx, glow, n.x, n.y, (broken ? 14 : 34) * s, broken ? 0.25 : 0.85);
      Render.drawGlow(ctx, r.glows.white, n.x, n.y, (broken ? 4 : 9) * s, broken ? 0.3 : 0.9);
    });
  }

  // --- Le Dormeur ---

  // Vue d'en haut : une carapace immense, ovale, pavée de plaques, qui respire très lentement ; la tête posée
  // devant, les nageoires repliées. Ses rêves s'élèvent de son dos en volutes pâles.
  function drawSleeper(r, c) {
    const { ctx } = r;
    const s = c.def.size;
    const px = 1 / r.camera.scale;
    const tint = tintOf(c);
    const glow = glowOf(r, tint);
    const breath = 1 + 0.025 * Math.sin(c.breath * Math.PI * 2);
    const at = (x, y) => Colossus.toWorld(c, x * breath, y * breath);
    const rx = 300, ry = 215;

    Render.drawGlow(ctx, glow, c.x, c.y, 420 * s, 0.07);
    // Nageoires repliées, tête et queue.
    ctx.strokeStyle = rgb(tint, 1);
    for (const [x, y] of [[170, -190], [170, 190], [-170, -170], [-170, 170]]) {
      const sx = Math.sign(y);
      ctx.globalAlpha = 0.08;
      line(ctx, [at(x, y * 0.8), at(x - 70, y + sx * 70), at(x - 150, y + sx * 40)], 34 * s, rgb(tint, 1));
      ctx.globalAlpha = 0.3;
      line(ctx, [at(x, y * 0.8), at(x - 70, y + sx * 70), at(x - 150, y + sx * 40)], 1.6 * px, rgb(tint, 1));
    }
    ctx.globalAlpha = 0.3;
    line(ctx, [at(-rx, 0), at(-rx - 90, 15), at(-rx - 150, -10)], 2 * px, rgb(tint, 1));
    const head = at(rx + 10, 0);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = rgb(tint, 1);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 60 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5 * px;
    ctx.stroke();

    // La carapace.
    const shell = [];
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      shell.push(at(Math.cos(ang) * rx, Math.sin(ang) * ry));
    }
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    shell.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2 * px;
    ctx.stroke();
    // Les plaques : deux anneaux et des rayons.
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1.2 * px;
    for (const k of [0.38, 0.7]) {
      ctx.beginPath();
      for (let a = 0; a <= 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const p = at(Math.cos(ang) * rx * k, Math.sin(ang) * ry * k);
        if (a === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2 + 0.2;
      const a = at(Math.cos(ang) * rx * 0.38, Math.sin(ang) * ry * 0.38);
      const b = at(Math.cos(ang) * rx, Math.sin(ang) * ry);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Ses yeux, clos tant qu'il dort.
    if (c.mode !== 'sleep') drawEyes(r, c, (x, y) => at(x, y));
    // Volutes de rêve qui montent de son dos.
    if (c.mode === 'sleep') {
      for (let k = 0; k < 9; k++) {
        const t = (c.time * 0.12 + k / 9) % 1;
        const base = at(((k * 37) % 200) - 100, ((k * 53) % 160) - 80);
        Render.drawGlow(ctx, glow, base.x + Math.sin(t * 6 + k) * 30, base.y - t * 260, 20 * s * (1 - t), 0.35 * (1 - t));
      }
    }
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

  Vide.Draw.beasts = { bird: drawBird, medusa: drawMedusa, swarm: drawSwarm, sleeper: drawSleeper };
  Vide.Draw.beastsBelow = new Set(['sleeper']);

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
    // Assaut : un cercle d'alerte autour de la lumière, le temps que la nuée se ramasse.
    rush(r, c, atk, k) {
      if (atk.phase !== 'telegraph') return;
      const { ctx } = r;
      ctx.globalAlpha = 0.15 + 0.4 * k;
      ctx.strokeStyle = '#b89cff';
      ctx.lineWidth = 2 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(atk.at.x, atk.at.y, 140 * (1.6 - 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
    },
    // Tourbillon : l'anneau qui va se resserrer.
    vortex(r, c, atk, k) {
      const { ctx } = r;
      const V = Colossus.ATTACKS.vortex;
      const ring = atk.phase === 'telegraph' ? V.from : V.from + (V.to - V.from) * Math.min(1, atk.t / V.active);
      ctx.globalAlpha = atk.phase === 'telegraph' ? 0.1 + 0.3 * k : 0.25;
      ctx.strokeStyle = '#6b3fd1';
      ctx.lineWidth = 30;
      ctx.beginPath();
      ctx.arc(atk.at.x, atk.at.y, ring, 0, Math.PI * 2);
      ctx.stroke();
    },
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
