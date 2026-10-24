// Dessin des colosses : corps-constellation, pattes articulées, sceaux, attaques annoncées.
(function (Vide) {
  'use strict';
  const { Render, Colossus } = Vide;

  const GOLD = [255, 226, 160];
  const LIFT = 90; // hauteur dessinée d'un colosse en vol (taille de référence)

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
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
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
      const knee = Colossus.knee(c, hip, foot);
      ctx.globalAlpha = 0.55;
      line(ctx, [hip, knee, foot], (kneeling ? 4 : 3) * px * 1.4, rgb(tint, 1));
      ctx.globalAlpha = 0.12;
      line(ctx, [hip, knee, foot], 12 * s, rgb(tint, 1));
      Render.drawGlow(ctx, glow, knee.x, knee.y, 14 * s, 0.7);
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
    drawEyes(r, c, (x, y) => Colossus.toWorld(c, x, y));
  }

  function drawEyes(r, c, place) {
    for (const [ex, ey] of c.body.eyes) {
      const eye = place(ex, ey);
      Render.drawGlow(r.ctx, r.glows.white, eye.x, eye.y, 9 * c.def.size, c.calm > 0.5 ? 0.6 : 0.95);
    }
  }

  // Serpent : une chaîne de vertèbres lumineuses, des nageoires qui ondulent, une tête aux yeux pâles.
  function drawSerpent(r, c) {
    const { ctx } = r;
    const s = c.def.size;
    const px = 1 / r.camera.scale;
    let tint = mix(c.def.tint, GOLD, c.calm);
    tint = mix(tint, [255, 255, 255], c.hitFlash * 0.6);
    const glow = glowOf(r, tint);
    const seg = c.segments;
    const n = seg.length;

    Render.drawGlow(ctx, glow, c.core.x, c.core.y, 420 * s, c.mode === 'kneel' ? 0.2 : 0.11);
    ctx.globalAlpha = 0.1;
    line(ctx, seg, 34 * s, rgb(tint, 1));
    ctx.globalAlpha = 0.55;
    line(ctx, seg, 2.5 * px, rgb(tint, 1));
    for (let k = 0; k < n; k++) {
      const p = seg[k];
      const taper = 1 - k / n;
      Render.drawGlow(ctx, glow, p.x, p.y, (10 + 16 * taper) * s, 0.75);
      // Nageoires : une paire toutes les trois vertèbres, qui battent avec la nage.
      if (k % 3 === 1 && k < n - 2) {
        const q = seg[k + 1];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        const flap = 1 + 0.35 * Math.sin(c.time * 4 - k * 0.5);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = rgb(tint, 1);
        ctx.lineWidth = 1.2 * px;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + (nx * side * 34 * taper * flap - dx / d * 18) * s, p.y + (ny * side * 34 * taper * flap - dy / d * 18) * s);
          ctx.stroke();
        }
      }
    }
    const head = seg[0];
    Render.drawGlow(ctx, glow, head.x, head.y, 52 * s, 0.7);
    // Les yeux suivent l'orientation de la tête (vers la vertèbre suivante, à l'opposé).
    const next = seg[1];
    const angle = Math.atan2(head.y - next.y, head.x - next.x);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    drawEyes(r, c, (x, y) => ({ x: head.x + (x * cos - y * sin) * s, y: head.y + (x * sin + y * cos) * s }));
  }

  // Toiles posées : rayons et cercles concentriques, qui pâlissent avant de disparaître.
  function drawWebs(r, game) {
    const { ctx } = r;
    const px = 1 / r.camera.scale;
    for (const w of game.webs) {
      const fade = Math.min(1, w.life / 1.5) * 0.45;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#e8fff4';
      ctx.lineWidth = px;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + Math.cos(a) * w.radius, w.y + Math.sin(a) * w.radius);
        ctx.stroke();
      }
      for (let ring = 1; ring <= 4; ring++) {
        ctx.beginPath();
        ctx.arc(w.x, w.y, (w.radius * ring) / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Sceaux : rune dorée qui pulse pour l'actif, cercle pâle pour les suivants, trace pour les brisés.
  // Un sceau voilé (pas encore étudié) ne se voit pas : seule l'onde qui le frôle fait frémir un voile gris.
  function drawSeals(r, c, game) {
    const { state } = game;
    // Un sceau protégé (cloche refermée…) brille moins : ce n'est pas le moment.
    const guard = Colossus.beast(c).guard;
    const shut = guard && guard(game, c) === 'closed' ? 0.3 : 1;
    const { ctx } = r;
    const px = 1 / r.camera.scale;
    const k = Colossus.reach(c);
    // (Un colosse en vol porte ses sceaux en l'air, avec son corps.)
    const lift = (c.air || 0) * LIFT * k;
    c.seals.forEach((seal, i) => {
      const at = Colossus.pointOf(c, seal.at);
      const p = { x: at.x, y: at.y - lift };
      if (seal.broken) {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#fff3d6';
        ctx.lineWidth = px;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 * k, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      if (Colossus.veiled(state, c, i)) {
        const flash = r.veils && r.veils.get(c.id);
        if (i !== c.active || !flash) return;
        const t = (r.time - flash) / 1.4;
        if (t >= 1) return;
        ctx.globalAlpha = 0.45 * (1 - t);
        ctx.strokeStyle = '#9ea6c8';
        ctx.lineWidth = 1.2 * px;
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          for (let a = 0; a <= 24; a++) {
            const ang = (a / 24) * Math.PI * 2;
            const wob = 1 + 0.18 * Math.sin(ang * 5 + r.time * 3 + ring * 2);
            const rad = (14 + ring * 9 + t * 20) * k * wob;
            const x = p.x + Math.cos(ang) * rad, y = p.y + Math.sin(ang) * rad;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        return;
      }
      if (i !== c.active) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#fff3d6';
        ctx.lineWidth = px;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13 * k, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      const beat = 0.6 + 0.4 * Math.sin(c.time * 4);
      Render.drawGlow(ctx, r.glows.rare, p.x, p.y, 60 * k * beat, 0.8 * shut);
      ctx.globalAlpha = 0.9 * shut;
      ctx.strokeStyle = '#ffe6a8';
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let n = 0; n <= 3; n++) {
        const a = c.time * 1.5 + (n / 3) * Math.PI * 2;
        const x = p.x + Math.cos(a) * 12 * k, y = p.y + Math.sin(a) * 12 * k;
        if (n === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Vie du sceau.
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.5 * px;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 25 * k, -Math.PI / 2, -Math.PI / 2 + (seal.hp / seal.max) * Math.PI * 2);
      ctx.stroke();
    });
  }

  // Anneau du séisme (ou son annonce), interrompu à chaque brèche.
  function ringWithGaps(ctx, atk, radius) {
    const step = 0.04;
    ctx.beginPath();
    let open = false;
    for (let a = 0; a < Math.PI * 2 + step / 2; a += step) {
      if (Colossus.inGap(atk, a)) {
        open = false;
        continue;
      }
      const x = atk.origin.x + Math.cos(a) * radius, y = atk.origin.y + Math.sin(a) * radius;
      if (open) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      open = true;
    }
    ctx.stroke();
  }

  // Attaques annoncées : cercles qui se remplissent (piétinement), cône qui s'épaissit (souffle).
  function drawAttack(r, c) {
    const atk = c.attack;
    if (!atk) return;
    const { ctx } = r;
    const a = Colossus.ATTACKS[atk.kind];
    const k = atk.phase === 'telegraph' ? Math.min(1, atk.t / (atk.telegraph || a.telegraph)) : 1;
    const px = 1 / r.camera.scale;
    ctx.globalCompositeOperation = 'source-over';
    // Attaques des colosses de la 1.8 : dessinées par draw-beasts.js.
    const custom = Vide.Draw.beastAttacks && Vide.Draw.beastAttacks[atk.kind];
    if (custom) {
      custom(r, c, atk, k);
    } else if (atk.kind === 'stomp') {
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
    } else if (atk.kind === 'web' || atk.kind === 'volley') {
      // La toile se dessine avant de tomber.
      ctx.globalAlpha = 0.15 + 0.35 * k;
      ctx.strokeStyle = '#cfffe8';
      ctx.lineWidth = 1.2 * px;
      for (const at of atk.webs || [atk.at]) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(at.x, at.y);
          ctx.lineTo(at.x + Math.cos(a) * atk.radius * k, at.y + Math.sin(a) * atk.radius * k);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(at.x, at.y, atk.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (atk.kind === 'quake') {
      // Annonce : l'anneau qui viendra, ses brèches marquées d'or. Puis l'onde qui s'étend.
      ctx.lineCap = 'butt';
      if (atk.phase === 'telegraph') {
        ctx.globalAlpha = 0.1 + 0.25 * k;
        ctx.strokeStyle = '#6b3fd1';
        ctx.lineWidth = 2 * px;
        ringWithGaps(ctx, atk, atk.length * (0.3 + 0.7 * k));
      } else {
        ctx.globalAlpha = 0.45 * (1 - 0.6 * (atk.ring / atk.length));
        ctx.strokeStyle = '#b89cff';
        ctx.lineWidth = Colossus.ATTACKS.quake.band;
        ringWithGaps(ctx, atk, atk.ring);
      }
      ctx.globalAlpha = atk.phase === 'telegraph' ? 0.4 + 0.5 * k : 0.5;
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = 2 * px;
      const w = Colossus.ATTACKS.quake.gap;
      for (const g of atk.gaps) {
        ctx.beginPath();
        ctx.arc(atk.origin.x, atk.origin.y, atk.length, g - w, g + w);
        ctx.stroke();
      }
      ctx.lineCap = 'round';
    } else if (atk.kind === 'sweep') {
      // L'arc entier qu'il va balayer, puis le faisceau qui le parcourt.
      ctx.globalAlpha = atk.phase === 'telegraph' ? 0.05 + 0.12 * k : 0.07;
      ctx.fillStyle = '#6b3fd1';
      ctx.beginPath();
      ctx.moveTo(atk.origin.x, atk.origin.y);
      ctx.arc(atk.origin.x, atk.origin.y, atk.length, Math.min(atk.from, atk.to), Math.max(atk.from, atk.to));
      ctx.closePath();
      ctx.fill();
      const active = atk.phase === 'active';
      ctx.globalAlpha = active ? 0.5 : 0.15 + 0.3 * k;
      ctx.fillStyle = active ? '#e9dcff' : '#8d63ff';
      ctx.beginPath();
      ctx.moveTo(atk.origin.x, atk.origin.y);
      ctx.arc(atk.origin.x, atk.origin.y, atk.length, atk.dir - atk.spread, atk.dir + atk.spread);
      ctx.closePath();
      ctx.fill();
    } else if (atk.kind === 'charge') {
      // Le couloir de la charge, tracé avant qu'il ne fonce.
      const w = atk.width * c.def.size;
      const ex = atk.origin.x + Math.cos(atk.dir) * atk.length, ey = atk.origin.y + Math.sin(atk.dir) * atk.length;
      ctx.globalAlpha = atk.phase === 'active' ? 0.12 : 0.08 + 0.25 * k;
      ctx.strokeStyle = '#6b3fd1';
      ctx.lineCap = 'round';
      ctx.lineWidth = w * 2;
      ctx.beginPath();
      ctx.moveTo(atk.origin.x, atk.origin.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.lineCap = 'round';
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

  // Ondes au sol : pas lourds et impacts de piétinement. (Et l'instant où l'onde a frôlé un sceau voilé.)
  function collect(r, game) {
    r.quakes = r.quakes || [];
    r.veils = r.veils || new Map();
    const { player } = game.state;
    for (const e of game.events) {
      if (e.type === 'veiled') r.veils.set(e.id, r.time);
      // Une pulsation de la Méduse (ou ses soins) : un anneau qui s'élargit.
      if (e.type === 'medusaPulse') r.quakes.push({ x: e.x, y: e.y, t: 0, size: 220 });
      if (e.type === 'mended') r.quakes.push({ x: e.x, y: e.y, t: 0, size: e.radius * 0.7 });
      if (e.type === 'phase') r.shake = Math.max(r.shake || 0, 12);
      if (e.type === 'footfall') {
        r.quakes.push({ x: e.x, y: e.y, t: 0, size: 40 });
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < 700) r.shake = Math.max(r.shake || 0, 4 * (1 - d / 700));
      } else if (e.type === 'quake') {
        for (const p of e.points) r.quakes.push({ x: p.x, y: p.y, t: 0, size: e.radius * 1.6 });
        // Une patte abattue au loin (colosse apaisé, ou en marche sur un village) ne secoue l'écran que de près.
        const d = Math.hypot(e.points[0].x - player.x, e.points[0].y - player.y);
        r.shake = Math.max(r.shake || 0, e.local ? 9 * Math.max(0, 1 - d / 900) : 9);
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

  // La Tisseuse apaisée tisse une route : des fils de son abdomen jusqu'au front du chantier.
  function drawWeaving(r, game, c) {
    if (!c.weaving || !game.state.roads.includes(c.weaving)) return;
    const { ctx } = r;
    const at = Vide.Allies.front(game.state, c.weaving);
    const from = Colossus.pointOf(c, 'spinneret');
    if (Math.hypot(at.x - from.x, at.y - from.y) > 700) return;
    ctx.strokeStyle = '#eafff6';
    ctx.lineWidth = 1.6 / r.camera.scale;
    for (let k = 0; k < 5; k++) {
      const sway = Math.sin(r.time * 3 + k * 1.7) * 30;
      ctx.globalAlpha = 0.45 + 0.1 * k / 5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo((from.x + at.x) / 2 + sway, (from.y + at.y) / 2 - sway, at.x + (k - 2) * 12, at.y + (k - 2) * 8);
      ctx.stroke();
    }
    Render.drawGlow(ctx, r.glows.light, at.x, at.y, 90, 0.6 + 0.2 * Math.sin(r.time * 5));
  }

  Vide.Draw.colossi = function (r, game, dt) {
    collect(r, game);
    const view = Render.viewBounds(r, 1200);
    drawWebs(r, game);
    for (const c of game.colossi) {
      if (c.core.x < view.left || c.core.x > view.right || c.core.y < view.top || c.core.y > view.bottom) continue;
      drawAttack(r, c);
      const custom = Vide.Draw.beasts && Vide.Draw.beasts[c.body.kind];
      if (custom) {
        if (!Vide.Draw.beastsBelow.has(c.body.kind)) custom(r, c, game);
      }
      else if (c.body.kind === 'serpent') drawSerpent(r, c);
      else drawBody(r, c);
      if (c.mode !== 'resident' && c.mode !== 'home') drawSeals(r, c, game);
      else if (c.id === 'tisseuse') drawWeaving(r, game, c);
    }
    drawQuakes(r, dt);
  };

  // Corps dessinés sous les territoires (le Dormeur : on bâtit sur son dos), avant tout le reste.
  Vide.Draw.colossiBelow = function (r, game) {
    const view = Render.viewBounds(r, 1500);
    for (const c of game.colossi) {
      if (!Vide.Draw.beastsBelow.has(c.body.kind)) continue;
      if (c.core.x < view.left || c.core.x > view.right || c.core.y < view.top || c.core.y > view.bottom) continue;
      Vide.Draw.beasts[c.body.kind](r, c, game);
    }
  };

  // Outils partagés avec draw-beasts.js.
  Vide.Draw.colossusKit = { GOLD, LIFT, mix, rgb, glowOf, line, drawEyes };

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
  // Entendu : un cercle pâle (on sait d'où vient le battement). Autour, un point par sceau, doré s'il est dévoilé.
  Vide.MapMarks.push((ctx, X, Y, state) => {
    for (const d of Vide.COLOSSI) {
      const st = Colossus.status(state, d.id);
      if (st !== 'found' && st !== 'heard') continue;
      const at = Colossus.lair(state, d);
      const alpha = st === 'found' ? 0.9 : 0.45;
      ctx.strokeStyle = `rgba(255, 217, 138, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(at.x), Y(at.y), 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 217, 138, ${alpha})`;
      ctx.beginPath();
      ctx.arc(X(at.x), Y(at.y), 2, 0, Math.PI * 2);
      ctx.fill();
      const shown = Colossus.revealed(state, d.id);
      d.seals.forEach((seal, i) => {
        const a = -Math.PI / 2 + (i / d.seals.length) * Math.PI * 2;
        ctx.fillStyle = i < shown ? 'rgba(255, 230, 168, 0.95)' : 'rgba(150, 160, 190, 0.45)';
        ctx.beginPath();
        ctx.arc(X(at.x) + Math.cos(a) * 12, Y(at.y) + Math.sin(a) * 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });
})(globalThis.Vide);
