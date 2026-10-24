// Dessin des créatures intermédiaires : des corps articulés, plus grands et plus travaillés que les êtres. Quatre
// pattes qui marchent (loup, cerf et ses bois), ou un corps d'anneaux qui ondule, une paire de pattes à chacun
// (scolopendre). Côté ombres : un corps noir cerné de violet, des yeux pâles ; côté lumière : des traits dorés et
// un halo ; la faune, d'un bleu laiteux. Une créature qui change de camp s'entoure d'un éclat.
(function (Vide) {
  'use strict';
  const { Render, Creatures } = Vide;

  const STYLE = {
    shadow: { fill: 'rgba(6, 2, 14, 0.95)', line: 'rgba(170, 120, 250, 0.75)', eye: '#e2d6ff' },
    light: { fill: 'rgba(255, 244, 215, 0.12)', line: 'rgba(255, 240, 200, 0.85)', eye: '#ffffff' },
    wild: { fill: 'rgba(200, 225, 255, 0.1)', line: 'rgba(190, 220, 255, 0.7)', eye: '#ffffff' },
  };

  let violet = null, gold = null, milk = null;

  function glowFor(r, side) {
    if (!violet) {
      violet = r.makeGlow(150, 90, 230);
      gold = r.makeGlow(255, 225, 160);
      milk = r.makeGlow(180, 210, 255);
    }
    return side === 'shadow' ? violet : side === 'light' ? gold : milk;
  }

  // Un point dans le repère de la créature : `along` vers l'avant, `side` vers sa gauche.
  function at(c, along, side) {
    const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
    return { x: c.x + ca * along - sa * side, y: c.y + sa * along + ca * side };
  }

  function quadruped(ctx, r, c, k, s) {
    const L = k.length;
    const W = L * 0.38;
    const px = 1 / r.camera.scale;
    const step = c.walked / (L * 0.45);
    // Les pattes : épaule ou hanche, genou, pied qui avance et recule (diagonales opposées).
    ctx.strokeStyle = s.line;
    ctx.lineWidth = Math.max(1.4 * px, L * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    [[0.32, 1, 0], [0.32, -1, Math.PI], [-0.3, 1, Math.PI], [-0.3, -1, 0]].forEach(([along, side, off]) => {
      const swing = Math.sin(step + off) * L * 0.2;
      const hip = at(c, L * along, side * W * 0.4);
      const knee = at(c, L * along + swing * 0.5 + L * 0.05, side * W * 0.7);
      const foot = at(c, L * along + swing * 1.2, side * W * 0.82);
      ctx.moveTo(hip.x, hip.y);
      ctx.lineTo(knee.x, knee.y);
      ctx.lineTo(foot.x, foot.y);
    });
    ctx.stroke();
    // Le corps, puis la tête.
    ctx.fillStyle = s.fill;
    ctx.lineWidth = 1.3 * px;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, L * 0.46, W * 0.5, c.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const head = at(c, L * 0.6, 0);
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, L * 0.19, W * 0.36, c.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Le museau.
    const snout = at(c, L * 0.8, 0);
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(snout.x, snout.y);
    ctx.stroke();
    if (k.antlers) {
      // Des bois qui se ramifient.
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const base = at(c, L * 0.62, side * W * 0.2);
        const top = at(c, L * 0.5, side * W * 1.3);
        const tip = at(c, L * 0.72, side * W * 1.6);
        const branch = at(c, L * 0.38, side * W * 1.55);
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(branch.x, branch.y);
      }
      ctx.stroke();
    } else {
      // Une queue qui balance.
      const tail = at(c, -L * 0.75, Math.sin(step * 0.5) * W * 0.6);
      const root = at(c, -L * 0.46, 0);
      ctx.beginPath();
      ctx.moveTo(root.x, root.y);
      ctx.quadraticCurveTo(at(c, -L * 0.62, 0).x, at(c, -L * 0.62, 0).y, tail.x, tail.y);
      ctx.stroke();
      // Deux oreilles pointues.
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const e0 = at(c, L * 0.62, side * W * 0.25), e1 = at(c, L * 0.55, side * W * 0.6);
        ctx.moveTo(e0.x, e0.y);
        ctx.lineTo(e1.x, e1.y);
      }
      ctx.stroke();
    }
    eyes(ctx, c, head, W * 0.16, s);
    ctx.lineCap = 'butt';
  }

  function segments(ctx, r, c, k, s) {
    const px = 1 / r.camera.scale;
    const n = c.trail.length;
    ctx.lineCap = 'round';
    // Les pattes d'abord (une paire par anneau, qui ondulent en vague).
    ctx.strokeStyle = s.line;
    ctx.lineWidth = Math.max(1 * px, k.length * 0.07);
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const p = c.trail[i], q = c.trail[i - 1];
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      const w = k.radius * (1 - (i / n) * 0.5);
      const wave = Math.sin(c.walked / 18 - i * 0.9) * 0.5;
      for (const side of [-1, 1]) {
        const la = a + side * (Math.PI / 2 + wave * side * 0.6);
        ctx.moveTo(p.x + Math.cos(a + side * Math.PI / 2) * w * 0.6, p.y + Math.sin(a + side * Math.PI / 2) * w * 0.6);
        ctx.lineTo(p.x + Math.cos(la) * w * 1.5, p.y + Math.sin(la) * w * 1.5);
      }
    }
    ctx.stroke();
    // Les anneaux, de la queue à la tête.
    ctx.fillStyle = s.fill;
    ctx.lineWidth = 1.2 * px;
    for (let i = n - 1; i >= 0; i--) {
      const p = c.trail[i];
      const w = k.radius * (1 - (i / n) * 0.55) * (i === 0 ? 1.1 : 0.8);
      ctx.beginPath();
      ctx.arc(p.x, p.y, w, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Des mandibules.
    const head = c.trail[0];
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const m0 = at(c, k.radius * 0.8, side * k.radius * 0.4);
      const m1 = at(c, k.radius * 1.6, side * k.radius * 0.15 * (1 + Math.sin(c.walked / 10)));
      ctx.moveTo(m0.x, m0.y);
      ctx.lineTo(m1.x, m1.y);
    }
    ctx.stroke();
    eyes(ctx, c, head, k.radius * 0.18, s);
    ctx.lineCap = 'butt';
  }

  function eyes(ctx, c, head, size, s) {
    ctx.fillStyle = s.eye;
    ctx.globalAlpha = 0.85;
    for (const side of [-1, 1]) {
      const e = at(c, 0, 0);
      const ex = head.x + (e.x - c.x) + Math.cos(c.angle) * size * 2 - Math.sin(c.angle) * side * size * 2.2;
      const ey = head.y + (e.y - c.y) + Math.sin(c.angle) * size * 2 + Math.cos(c.angle) * side * size * 2.2;
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1.1, size * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  Vide.Draw.creatures = function (r, game) {
    const { ctx } = r;
    const view = Render.viewBounds(r, 200);
    for (const c of game.creatures.list) {
      if (c.x < view.left || c.x > view.right || c.y < view.top || c.y > view.bottom) continue;
      const k = Creatures.kind(c.kind);
      const s = STYLE[c.side];
      const glow = glowFor(r, c.side);
      // Un halo (en lumière ajoutée), puis le corps (peint par-dessus).
      ctx.globalCompositeOperation = 'lighter';
      const size = k.body === 'segments' ? k.radius * 3 : k.length * 1.1;
      Render.drawGlow(ctx, glow, c.x, c.y, size, (c.side === 'shadow' ? 0.35 : 0.3) + c.flash * 0.4);
      if (c.turned > 0) {
        ctx.globalAlpha = c.turned;
        ctx.strokeStyle = c.side === 'shadow' ? '#b48cff' : '#fff2c8';
        ctx.lineWidth = 2 / r.camera.scale;
        ctx.beginPath();
        ctx.arc(c.x, c.y, size * (1.6 - c.turned * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = c.side === 'shadow' ? 'source-over' : 'lighter';
      ctx.globalAlpha = 1;
      if (k.body === 'segments') segments(ctx, r, c, k, s);
      else quadruped(ctx, r, c, k, s);
      // Sa vie, si entamée.
      if (c.hp < c.maxHp) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = c.side === 'shadow' ? '#b8a0ff' : '#ffe7b0';
        ctx.lineWidth = 2 / r.camera.scale;
        ctx.beginPath();
        ctx.arc(c.x, c.y, size * 0.75, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, c.hp) / c.maxHp) * Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
  };
})(globalThis.Vide);
