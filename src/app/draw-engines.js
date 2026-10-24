// Dessin des engins de siège : la baliste (un arc tendu sur un socle, tourné vers sa cible), la chaîne (un
// ancrage, et des maillons tendus vers le colosse qu'elle retient), les traits qui volent, les chantiers.
(function (Vide) {
  'use strict';
  const { Render, Engines } = Vide;

  const BRONZE = '#ffd6a0';
  const K = 1.6; // taille des engins à l'écran

  // Traits tirés récemment (purement visuels).
  function collect(r, game) {
    r.bolts = r.bolts || [];
    for (const e of game.events) {
      if (e.type === 'bolt') r.bolts.push({ from: e.from, to: e.to, t: 0 });
      if (e.type === 'chained') r.shake = Math.max(r.shake || 0, 6);
    }
  }

  // Orientation d'une baliste : vers le colosse en combat le plus proche, sinon vers le haut.
  function aim(game, e) {
    const c = Engines.foe(game, e.x, e.y, Vide.CONFIG.engines.ballista.range * 1.3);
    return c ? Math.atan2(c.core.y - e.y, c.core.x - e.x) : -Math.PI / 2;
  }

  function drawBallista(r, game, e, px) {
    const { ctx } = r;
    const a = aim(game, e);
    const cos = Math.cos(a), sin = Math.sin(a);
    const at = (lx, ly) => ({ x: e.x + (lx * cos - ly * sin) * K, y: e.y + (lx * sin + ly * cos) * K });
    // Le socle, puis l'arc et sa corde, puis le trait engagé.
    ctx.beginPath();
    ctx.arc(e.x, e.y, 16 * K, 0, Math.PI * 2);
    ctx.stroke();
    const tips = [at(4, -26), at(14, 0), at(4, 26)];
    ctx.beginPath();
    ctx.moveTo(tips[0].x, tips[0].y);
    ctx.quadraticCurveTo(tips[1].x + cos * 10 * K, tips[1].y + sin * 10 * K, tips[2].x, tips[2].y);
    ctx.stroke();
    const back = at(-12, 0);
    ctx.lineWidth = px;
    ctx.beginPath();
    ctx.moveTo(tips[0].x, tips[0].y);
    ctx.lineTo(back.x, back.y);
    ctx.lineTo(tips[2].x, tips[2].y);
    ctx.stroke();
    const head = at(30, 0);
    ctx.beginPath();
    ctx.moveTo(back.x, back.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
  }

  function drawChain(r, game, e, px) {
    const { ctx } = r;
    // L'ancrage : un anneau et une croix plantée dans le vide.
    ctx.beginPath();
    ctx.arc(e.x, e.y, 14 * K, 0, Math.PI * 2);
    ctx.moveTo(e.x - 9 * K, e.y);
    ctx.lineTo(e.x + 9 * K, e.y);
    ctx.moveTo(e.x, e.y - 9 * K);
    ctx.lineTo(e.x, e.y + 9 * K);
    ctx.stroke();
    // Sa portée, à peine visible.
    ctx.globalAlpha *= 0.25;
    ctx.setLineDash([6 * px, 10 * px]);
    ctx.beginPath();
    ctx.arc(e.x, e.y, Vide.CONFIG.engines.chain.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Les maillons tendus vers le colosse qu'elle retient.
    const c = game.colossi.find((k) => k.bound === e);
    if (!c) return;
    const dx = c.core.x - e.x, dy = c.core.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const n = Math.max(4, Math.floor(d / 26));
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6 * px;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const sag = Math.sin(t * Math.PI) * 18 * Math.sin(r.time * 9 + k); // la chaîne vibre sous l'effort
      const x = e.x + dx * t - (dy / d) * sag, y = e.y + dy * t + (dx / d) * sag;
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 5, Math.atan2(dy, dx) + (k % 2 ? Math.PI / 2 : 0), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  Vide.Draw.engines = function (r, game, dt) {
    collect(r, game);
    const { ctx } = r;
    const px = 1 / r.camera.scale;
    const view = Render.viewBounds(r, 900);
    ctx.lineCap = 'round';
    for (const e of game.state.engines) {
      if (e.x < view.left || e.x > view.right || e.y < view.top || e.y > view.bottom) continue;
      const ready = Engines.ready(e);
      ctx.globalAlpha = ready ? 0.8 : 0.35;
      ctx.strokeStyle = BRONZE;
      ctx.lineWidth = 2 * px;
      if (!ready) ctx.setLineDash([4 * px, 5 * px]);
      if (e.kind === 'baliste') drawBallista(r, game, e, px);
      else drawChain(r, game, e, px);
      ctx.setLineDash([]);
      Render.drawGlow(ctx, r.glows.rare, e.x, e.y, 26 * K, ready ? 0.35 : 0.15);
      // Chantier : un arc qui se remplit. Engin abîmé : ce qui lui reste.
      const max = Engines.def(e.kind).hp;
      const k = ready ? e.hp / max : e.built;
      if (!ready || k < 1) {
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = ready ? '#ff9f7a' : BRONZE;
        ctx.lineWidth = 2 * px;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 24 * K, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        ctx.stroke();
      }
    }
    // Les traits de baliste : une longue ligne brève, un éclat à l'impact.
    for (let i = r.bolts.length - 1; i >= 0; i--) {
      const b = r.bolts[i];
      b.t += dt;
      if (b.t > 0.35) {
        r.bolts.splice(i, 1);
        continue;
      }
      const k = b.t / 0.35;
      const head = Math.min(1, k * 2.5);
      const x = b.from.x + (b.to.x - b.from.x) * head, y = b.from.y + (b.to.y - b.from.y) * head;
      const tx = b.from.x + (b.to.x - b.from.x) * Math.max(0, head - 0.25), ty = b.from.y + (b.to.y - b.from.y) * Math.max(0, head - 0.25);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = BRONZE;
      ctx.lineWidth = 3 * px;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (head >= 1) Render.drawGlow(ctx, r.glows.rare, b.to.x, b.to.y, 60, 1 - k);
    }
    ctx.globalAlpha = 1;
  };

  // Sur la carte : un petit losange bronze par engin.
  Vide.MapMarks = Vide.MapMarks || [];
  Vide.MapMarks.push((ctx, X, Y, state) => {
    for (const e of state.engines) {
      const x = X(e.x), y = Y(e.y);
      ctx.fillStyle = Engines.ready(e) ? 'rgba(255, 214, 160, 0.9)' : 'rgba(255, 214, 160, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x, y - 3.5);
      ctx.lineTo(x + 3.5, y);
      ctx.lineTo(x, y + 3.5);
      ctx.lineTo(x - 3.5, y);
      ctx.closePath();
      ctx.fill();
    }
  });
})(globalThis.Vide);
