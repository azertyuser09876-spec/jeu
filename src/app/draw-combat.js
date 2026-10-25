// Dessin du combat : ombres, traits de lumière, vitalité, marées, soins, éclats de disparition.
(function (Vide) {
  'use strict';
  const { Render, Shadows } = Vide;

  // Sprites pré-dessinés : un corps d'ombre (sombre, opaque au centre) et son liseré violet.
  function makeSprite(stops) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  let sprites = null;
  function ensureSprites(r) {
    if (sprites) return sprites;
    sprites = {
      dark: makeSprite([[0, 'rgba(4, 2, 10, 0.97)'], [0.55, 'rgba(10, 5, 22, 0.85)'], [1, 'rgba(10, 5, 22, 0)']]),
      rim: r.makeGlow(150, 100, 255),
      heal: r.makeGlow(255, 170, 220),
    };
    return sprites;
  }

  // --- Ombres ---

  // Une horde (des centaines d'ombres à l'écran) : tous les liserés d'un coup, puis tous les corps — sans volutes ni
  // signes (un seul changement de composition par image, au lieu de deux par ombre).
  const HORDE = 150;
  function drawHorde(r, list) {
    const { ctx } = r;
    const sp = sprites;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of list) Render.drawGlow(ctx, sp.rim, s.x, s.y, Shadows.kind(s.kind).radius * 2.8, 0.5 + s.hitFlash * 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.95;
    for (const s of list) {
      const R = Shadows.kind(s.kind).radius;
      ctx.drawImage(sp.dark, s.x - R * 1.5, s.y - R * 1.5, R * 3, R * 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawShadow(r, s, t) {
    const { ctx } = r;
    const k = Shadows.kind(s.kind);
    const sp = sprites;
    const R = k.radius;

    // Liseré violet (lumière ajoutée) puis corps sombre (peinture par-dessus).
    ctx.globalCompositeOperation = 'lighter';
    Render.drawGlow(ctx, sp.rim, s.x, s.y, R * 2.8, 0.5 + s.hitFlash * 0.5);
    ctx.globalCompositeOperation = 'source-over';
    // Fumée : un corps sombre et quelques lobes qui ondulent autour, comme une fumée épaisse.
    ctx.globalAlpha = 0.95;
    ctx.drawImage(sp.dark, s.x - R * 1.5, s.y - R * 1.5, R * 3, R * 3);
    for (let i = 0; i < 3; i++) {
      const a = s.phase + i * 2.1 + t * (0.7 + i * 0.25);
      const ox = Math.cos(a) * R * 0.5, oy = Math.sin(a * 1.3) * R * 0.5;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(sp.dark, s.x + ox - R, s.y + oy - R, R * 2, R * 2);
    }
    // Deux yeux pâles, tournés vers où elle va.
    const speed = Math.hypot(s.vx, s.vy);
    const dirX = speed > 1 ? s.vx / speed : Math.cos(s.phase);
    const dirY = speed > 1 ? s.vy / speed : Math.sin(s.phase);
    // Signes de chaque nature : des cornes pour la bélière, des épines pour la cracheuse, une traînée de poussière
    // sombre derrière la fouisseuse.
    if (k.id === 'beliere') {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#1a0830';
      ctx.lineWidth = R * 0.28;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const bx = s.x + dirX * R * 0.6 - dirY * side * R * 0.5, by = s.y + dirY * R * 0.6 + dirX * side * R * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + dirX * R * 0.9, by + dirY * R * 0.9, bx + (dirX * 0.6 - dirY * side) * R * 0.9, by + (dirY * 0.6 + dirX * side) * R * 0.9);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else if (k.id === 'cracheuse') {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#120420';
      ctx.lineWidth = 2 / r.camera.scale;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = s.phase + t * 0.6 + (i / 7) * Math.PI * 2;
        ctx.moveTo(s.x + Math.cos(a) * R * 0.8, s.y + Math.sin(a) * R * 0.8);
        ctx.lineTo(s.x + Math.cos(a) * R * 1.6, s.y + Math.sin(a) * R * 1.6);
      }
      ctx.stroke();
    } else if (k.id === 'fouisseuse') {
      for (let i = 1; i <= 4; i++) {
        ctx.globalAlpha = 0.5 - i * 0.1;
        ctx.drawImage(sp.dark, s.x - dirX * R * i * 0.9 - R * 0.6, s.y - dirY * R * i * 0.9 - R * 0.6, R * 1.2, R * 1.2);
      }
    }
    const blink = Math.sin(t * 0.9 + s.phase * 7) > 0.97 ? 0.1 : 1;
    ctx.fillStyle = '#d9ccff';
    ctx.globalAlpha = 0.8 * blink;
    for (const side of [-1, 1]) {
      const ex = s.x + dirX * R * 0.35 - dirY * side * R * 0.28;
      const ey = s.y + dirY * R * 0.35 + dirX * side * R * 0.28;
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.2, R * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
    // Vie restante, si entamée.
    if (s.hp < s.maxHp) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#b8a0ff';
      ctx.lineWidth = 1.5 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R * 1.5, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, s.hp) / s.maxHp) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
  }

  // --- Traits de lumière ---

  function drawProjectiles(r, game) {
    const { ctx } = r;
    for (const p of game.projectiles) {
      // Un harpon : plus long, plus épais, orangé.
      const harpoon = p.source === 'harpoon';
      const tail = harpoon ? 0.08 : 0.04;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = harpoon ? '#ffb48a' : p.source === 'tower' ? '#fff3d6' : '#cfe4ff';
      ctx.lineWidth = (harpoon ? 3 : 2) / r.camera.scale;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * tail, p.y - p.vy * tail);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      Render.drawGlow(ctx, r.glows.light, p.x, p.y, 8, 0.9);
    }
  }

  // --- Soins des veilleuses ---

  function drawHealing(r, game) {
    const { ctx } = r;
    for (const b of game.colony.beings) {
      if (!b.healing) continue;
      const tx = b.healing.x, ty = b.healing.y;
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ffc4e6';
      ctx.lineWidth = 1.5 / r.camera.scale;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      const k = (r.time * 1.5) % 1;
      Render.drawGlow(ctx, sprites.heal, b.x + (tx - b.x) * k, b.y + (ty - b.y) * k, 7, 0.9);
    }
  }

  // --- Éclats : une ombre qui se dissipe, un être qui s'éteint ---

  function collectEffects(r, game) {
    r.effects = r.effects || [];
    for (const e of game.events) {
      if (e.type === 'shadowDown') r.effects.push({ x: e.x, y: e.y, t: 0, life: 0.9, kind: 'shadow' });
      if (e.type === 'beingDown') r.effects.push({ x: e.x, y: e.y, t: 0, life: 0.8, kind: 'being' });
    }
  }

  function drawEffects(r, dt) {
    const { ctx } = r;
    const list = r.effects;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;
      if (e.t >= e.life) {
        list.splice(i, 1);
        continue;
      }
      const k = e.t / e.life;
      const glow = e.kind === 'shadow' ? sprites.rim : r.glows.light;
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.strokeStyle = e.kind === 'shadow' ? '#b8a0ff' : '#d6eaff';
      ctx.lineWidth = 1.5 / r.camera.scale;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6 + k * 40, 0, Math.PI * 2);
      ctx.stroke();
      for (let j = 0; j < 6; j++) {
        const a = j * 1.047 + e.x;
        Render.drawGlow(ctx, glow, e.x + Math.cos(a) * k * 34, e.y + Math.sin(a) * k * 34, 6, (1 - k) * 0.9);
      }
    }
  }

  // --- Lumière du joueur : anneau de vitalité ---

  function drawVitality(r, game) {
    const v = game.vitality;
    const max = game.stats.vitality;
    if (v.hp >= max && v.invulnerable <= 0) return;
    const { ctx } = r;
    const { x, y } = game.state.player;
    ctx.globalAlpha = v.invulnerable > 0 ? 0.3 + 0.3 * Math.sin(r.time * 20) : 0.55;
    ctx.strokeStyle = v.hp / max < 0.35 ? '#c9a0ff' : '#e8f2ff';
    ctx.lineWidth = 2 / r.camera.scale;
    ctx.beginPath();
    ctx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, v.hp) / max) * Math.PI * 2);
    ctx.stroke();
  }

  // Dans le monde : ombres, traits, soins, éclats, vitalité.
  Vide.Draw.combat = function (r, game, dt) {
    ensureSprites(r);
    collectEffects(r, game);
    const view = Render.viewBounds(r, 60);
    const t = r.time;
    drawHealing(r, game);
    const seen = game.shadows.list.filter((s) => s.x >= view.left && s.x <= view.right && s.y >= view.top && s.y <= view.bottom);
    if (seen.length > HORDE) drawHorde(r, seen);
    else for (const s of seen) drawShadow(r, s, t);
    drawProjectiles(r, game);
    drawEffects(r, dt);
    drawVitality(r, game);
  };

  // À l'écran (après le monde) : voile violet quand la lumière est touchée, flèche vers la marée.
  Vide.Draw.combatOverlay = function (r, game) {
    const { ctx } = r;
    const hurt = game.vitality.hurt;
    if (hurt > 0) {
      const grad = ctx.createRadialGradient(r.width / 2, r.height / 2, Math.min(r.width, r.height) * 0.3,
        r.width / 2, r.height / 2, Math.max(r.width, r.height) * 0.75);
      grad.addColorStop(0, 'rgba(90, 40, 160, 0)');
      grad.addColorStop(1, `rgba(90, 40, 160, ${0.35 * hurt})`);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, r.width, r.height);
    }
    // Marée en approche : une flèche violette sur le bord, vers le centre de la marée.
    let n = 0, cx = 0, cy = 0;
    for (const s of game.shadows.list) {
      if (s.origin !== 'tide') continue;
      cx += s.x; cy += s.y; n++;
    }
    if (n) Render.edgePointer(r, cx / n, cy / n, '#b48cff', 0.55 + 0.3 * Math.sin(r.time * 4));
  };
})(globalThis.Vide);
