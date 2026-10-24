// Dessin des colosses : corps-constellation, pattes articulées, sceaux, attaques annoncées.
(function (Vide) {
  'use strict';
  const { Render, Colossus } = Vide;

  const GOLD = [255, 226, 160];

  function mix(a, b, t) {
    return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  }

  function rgb(c, alpha) {
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  }

  // Halos teintés, créés à la demande et gardés.
  const glowCache = {};
  function glowOf(r, c) {
    const key = c.join(',');
    if (!glowCache[key]) glowCache[key] = r.makeGlow(c[0], c[1], c[2]);
    return glowCache[key];
  }

  function line(ctx, pts, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }

  function drawBody(r, c) {
    const { ctx } = r;
    const s = c.def.size;
    const px = 1 / r.camera.scale;
    // Sauvage : argent bleuté. Apaisé : doré. Touché : il blanchit un instant.
    let tint = mix(c.def.tint, GOLD, c.calm);
    tint = mix(tint, [255, 255, 255], c.hitFlash * 0.6);
    const glow = glowOf(r, tint);
    const kneeling = c.mode === 'kneel';
    const breath = 1 + Math.sin(c.time * 0.8) * 0.04;

    // Aura immense.
    Render.drawGlow(ctx, glow, c.x, c.y, 330 * s * breath, kneeling ? 0.22 : 0.13);

    // Silhouette : la masse du corps, translucide, qui respire.
    const half = c.body.outline;
    const shape = half.concat(half.slice(1, -1).reverse().map(([x, y]) => [x, -y]))
      .map(([x, y]) => Colossus.toWorld(c, x, y * breath));
    ctx.globalAlpha = kneeling ? 0.16 : 0.1;
    ctx.fillStyle = rgb(tint, 1);
    ctx.beginPath();
    shape.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = rgb(tint, 1);
    ctx.lineWidth = 1.2 * px;
    ctx.stroke();

    // Pattes : hanche → genou → pied, articulations lumineuses.
    c.body.legs.forEach((l, i) => {
      const leg = c.legs[i];
      const hip = Colossus.toWorld(c, l.hip[0], l.hip[1]);
      const foot = leg.foot;
      const knee = Colossus.knee(c, hip, foot, l.side);
      ctx.globalAlpha = 0.55;
      line(ctx, [hip, knee, foot], (kneeling ? 4 : 3) * px * 1.4, rgb(tint, 1));
      ctx.globalAlpha = 0.12;
      line(ctx, [hip, knee, foot], 16 * px, rgb(tint, 1));
      Render.drawGlow(ctx, glow, knee.x, knee.y, 18, 0.7);
      // Un pied levé brille plus et grossit : on « voit » la hauteur du pas.
      Render.drawGlow(ctx, glow, foot.x, foot.y, (22 + leg.lift * 22) * s, 0.55 + leg.lift * 0.3);
    });

    // Colonne vertébrale et queue.
    const spine = c.body.spine.map((p) => Colossus.toWorld(c, p[0], p[1]));
    const tail = Colossus.tailPoints(c);
    const back = spine.concat(tail);
    ctx.globalAlpha = 0.1;
    line(ctx, back, 20 * s, rgb(tint, 1));
    ctx.globalAlpha = 0.6;
    line(ctx, back, 2.5 * px, rgb(tint, 1));
    back.forEach((p, i) => Render.drawGlow(ctx, glow, p.x, p.y, (i < spine.length ? 16 : 10) * s, 0.75));

    // Côtes : de fines courbes de part et d'autre du dos.
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = rgb(tint, 1);
    ctx.lineWidth = 1.2 * px;
    for (let k = 1; k < c.body.spine.length - 1; k++) {
      const [sx] = c.body.spine[k];
      for (const side of [-1, 1]) {
        const a = Colossus.toWorld(c, sx, 0);
        const m = Colossus.toWorld(c, sx - 10, side * 42);
        const b = Colossus.toWorld(c, sx - 28, side * 58);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
        ctx.stroke();
      }
    }

    // Tête et yeux.
    const head = Colossus.pointOf(c, 'head');
    Render.drawGlow(ctx, glow, head.x, head.y, 46 * s, 0.6);
    for (const side of [-1, 1]) {
      const eye = Colossus.toWorld(c, 170, side * 14);
      Render.drawGlow(ctx, r.glows.white, eye.x, eye.y, 9 * s, c.calm > 0.5 ? 0.6 : 0.95);
    }
  }

  // Sceaux : rune dorée qui pulse pour l'actif, cercle pâle pour les suivants, trace pour les brisés.
  function drawSeals(r, c) {
    const { ctx } = r;
    const px = 1 / r.camera.scale;
    c.seals.forEach((seal, i) => {
      const p = Colossus.pointOf(c, seal.at);
      if (seal.broken) {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#fff3d6';
        ctx.lineWidth = px;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      if (i !== c.active) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#fff3d6';
        ctx.lineWidth = px;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      const beat = 0.6 + 0.4 * Math.sin(c.time * 4);
      Render.drawGlow(ctx, r.glows.rare, p.x, p.y, 60 * beat, 0.8);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffe6a8';
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) {
        const a = c.time * 1.5 + (k / 3) * Math.PI * 2;
        const x = p.x + Math.cos(a) * 12, y = p.y + Math.sin(a) * 12;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Vie du sceau.
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.5 * px;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 25, -Math.PI / 2, -Math.PI / 2 + (seal.hp / seal.max) * Math.PI * 2);
      ctx.stroke();
    });
  }

  // Attaques annoncées : cercles qui se remplissent (piétinement), cône qui s'épaissit (souffle).
  function drawAttack(r, c) {
    const atk = c.attack;
    if (!atk) return;
    const { ctx } = r;
    const a = Colossus.ATTACKS[atk.kind];
    const k = atk.phase === 'telegraph' ? Math.min(1, atk.t / a.telegraph) : 1;
    ctx.globalCompositeOperation = 'source-over';
    if (atk.kind === 'stomp') {
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
    } else {
      const active = atk.phase === 'active';
      ctx.globalAlpha = active ? 0.45 : 0.08 + 0.22 * k;
      ctx.fillStyle = active ? '#e9dcff' : '#6b3fd1';
      ctx.beginPath();
      ctx.moveTo(atk.origin.x, atk.origin.y);
      ctx.arc(atk.origin.x, atk.origin.y, atk.length * (active ? 1 : 0.3 + 0.7 * k), atk.dir - atk.spread, atk.dir + atk.spread);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
  }

  // Ondes au sol : pas lourds et impacts de piétinement.
  function collect(r, game) {
    r.quakes = r.quakes || [];
    const { player } = game.state;
    for (const e of game.events) {
      if (e.type === 'footfall') {
        r.quakes.push({ x: e.x, y: e.y, t: 0, size: 40 });
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < 700) r.shake = Math.max(r.shake || 0, 4 * (1 - d / 700));
      } else if (e.type === 'quake') {
        for (const p of e.points) r.quakes.push({ x: p.x, y: p.y, t: 0, size: e.radius * 1.6 });
        r.shake = Math.max(r.shake || 0, 9);
      }
    }
  }

  function drawQuakes(r, dt) {
    const { ctx } = r;
    for (let i = r.quakes.length - 1; i >= 0; i--) {
      const q = r.quakes[i];
      q.t += dt;
      if (q.t > 0.8) {
        r.quakes.splice(i, 1);
        continue;
      }
      const k = q.t / 0.8;
      ctx.globalAlpha = (1 - k) * 0.4;
      ctx.strokeStyle = '#dfe8ff';
      ctx.lineWidth = 1.5 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (0.4 + k), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  Vide.Draw.colossi = function (r, game, dt) {
    collect(r, game);
    const view = Render.viewBounds(r, 600);
    for (const c of game.colossi) {
      if (c.x < view.left || c.x > view.right || c.y < view.top || c.y > view.bottom) continue;
      drawAttack(r, c);
      drawBody(r, c);
      if (c.mode !== 'resident' && c.mode !== 'home') drawSeals(r, c);
    }
    drawQuakes(r, dt);
  };

  // Battement : une flèche dorée qui bat comme un cœur, vers un colosse pas encore apaisé.
  Vide.Draw.colossiOverlay = function (r, game) {
    for (const c of game.colossi) {
      if (c.mode === 'resident' || c.mode === 'home' || c.mode === 'calm') continue;
      const t = r.time % 1.6;
      const beat = Math.max(0, Math.sin(t * 10)) * (t < 0.65 ? 1 : 0);
      Render.edgePointer(r, c.x, c.y, '#ffd98a', 0.3 + 0.6 * beat);
    }
  };

  // Repère du colosse sur la carte une fois rencontré.
  Vide.MapMarks = Vide.MapMarks || [];
  Vide.MapMarks.push((ctx, X, Y, state) => {
    for (const d of Vide.COLOSSI) {
      const st = Colossus.status(state, d.id);
      if (st !== 'found') continue;
      const at = Colossus.lair(state, d);
      ctx.strokeStyle = 'rgba(255, 217, 138, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(at.x), Y(at.y), 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 217, 138, 0.9)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(d.name, X(at.x) + 11, Y(at.y) + 4);
    }
  });
})(globalThis.Vide);
