// Les tableaux : des cinématiques peintes en code, sans texte. Chaque tableau est une suite de plans
// { d (secondes), draw(g), sound?, fadeIn?, fadeOut? } ; g donne le contexte, la taille (w, h, u : échelle d'un
// écran de 1000 × 700), le centre (cx, cy), l'avancée du plan (p de 0 à 1, t en secondes) et l'état de la partie.
// Les colosses y sont peints en constellations, d'après leur corps (Colossus.BODIES).
(function (Vide) {
  'use strict';
  const { util } = Vide;

  const GOLD = [255, 226, 160];
  const BLUE = [190, 210, 255];

  // --- Outils ---

  const glows = new Map();
  function glow(renderer, color) {
    const key = color.join(',');
    if (!glows.has(key)) glows.set(key, renderer.makeGlow(color[0], color[1], color[2]));
    return glows.get(key);
  }

  const rgb = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a === undefined ? 1 : a})`;
  const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  const ease = (p) => p * p * (3 - 2 * p);
  const clamp01 = (x) => util.clamp(x, 0, 1);

  // Nombre pseudo-aléatoire stable (mêmes étoiles à chaque image).
  function rand(i, salt) {
    return util.hash2(i, salt || 0, 7349);
  }

  function dot(g, color, x, y, radius, alpha) {
    if (alpha <= 0 || radius <= 0) return;
    Vide.Render.drawGlow(g.ctx, g.glow(color), x, y, radius, Math.min(1, alpha));
  }

  function path(ctx, pts, close) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (close) ctx.closePath();
  }

  // Un ciel d'étoiles discrètes, qui scintillent.
  function stars(g, count, alpha, drift) {
    const { ctx, w, h } = g;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const x = (rand(i, 1) * w + (drift || 0) * g.time * (0.3 + rand(i, 3))) % w;
      const y = rand(i, 2) * h;
      const tw = 0.5 + 0.5 * Math.sin(g.time * (1 + rand(i, 4) * 2) + i);
      dot(g, rand(i, 5) < 0.2 ? GOLD : BLUE, x, y, (2 + rand(i, 6) * 3) * g.u, alpha * (0.3 + 0.7 * tw));
    }
  }

  // --- Les colosses en constellations ---

  // Points (locaux, colosse tourné vers +x) qui dessinent son corps, selon sa forme : des traits et des étoiles.
  function figure(d, time) {
    const B = Vide.Colossus.BODIES[d.body];
    const lines = [];
    const nodes = [];
    const P = (x, y) => ({ x, y });
    switch (B.kind) {
      case 'legged': {
        const spine = B.spine.map(([x, y]) => P(x, y));
        if (B.tail) {
          const last = spine[spine.length - 1];
          for (let k = 1; k <= B.tail.segments; k++) {
            spine.push(P(last.x - k * (B.tail.length / B.tail.segments), Math.sin(time * 1.2 + k * 0.6) * k * 4));
          }
        }
        lines.push(spine);
        for (const l of B.legs) {
          const hip = P(l.hip[0], l.hip[1]);
          const foot = P(l.rest[0], l.rest[1]);
          const knee = P((hip.x + foot.x) / 2 + Math.sign(l.rest[0] - l.hip[0] || 1) * 10, (hip.y + foot.y) / 2 + l.side * 40);
          lines.push([hip, knee, foot]);
          nodes.push(knee, foot);
        }
        nodes.push(...spine);
        break;
      }
      case 'serpent': {
        const chain = [];
        for (let k = 0; k < B.segments; k++) chain.push(P(-k * B.spacing, Math.sin(time * 1.5 - k * 0.45) * 22));
        lines.push(chain);
        nodes.push(...chain.filter((_, k) => k % 2 === 0));
        break;
      }
      case 'bird': {
        const spine = [P(150, 0), P(60, 0), P(0, 0), P(-100, 0)];
        lines.push(spine);
        const flap = Math.sin(time * 2);
        for (const side of [-1, 1]) {
          const wing = [P(20, side * 20), P(-5 + flap * 20, side * 120), P(-70 + flap * 40, side * B.wingspan)];
          lines.push(wing);
          for (let f = 0; f <= 5; f++) {
            const t = f / 5;
            const a = P(wing[1].x + (wing[2].x - wing[1].x) * t, wing[1].y + (wing[2].y - wing[1].y) * t);
            lines.push([a, P(a.x - 50 - 20 * t, a.y)]);
          }
          nodes.push(...wing);
        }
        for (const y of [-30, 0, 30]) lines.push([P(-100, 0), P(-170, y)]);
        nodes.push(...spine);
        break;
      }
      case 'medusa': {
        const bell = [];
        for (let a = 0; a <= 24; a++) {
          const ang = (a / 24) * Math.PI * 2;
          bell.push(P(Math.cos(ang) * B.bell, Math.sin(ang) * B.bell * (1 + 0.04 * Math.cos(ang * 12))));
        }
        lines.push(bell);
        for (let t = 0; t < B.tentacles; t++) {
          const off = (t / (B.tentacles - 1) - 0.5) * 2 * B.bell * 0.8;
          const chain = [];
          for (let k = 0; k < B.links; k++) chain.push(P(-B.bell * 0.6 - k * B.spacing, off + Math.sin(time * 2 + t + k * 0.5) * 8));
          lines.push(chain);
        }
        nodes.push(P(0, 0), ...bell.filter((_, k) => k % 3 === 0));
        break;
      }
      case 'swarm': {
        for (let i = 0; i < 140; i++) {
          const a = rand(i, 11) * Math.PI * 2 + time * (rand(i, 12) - 0.5) * 0.6;
          const r = B.cloud * Math.sqrt(rand(i, 13));
          nodes.push(P(Math.cos(a) * r, Math.sin(a) * r));
        }
        break;
      }
      case 'sleeper': {
        const shell = [];
        for (let a = 0; a <= 32; a++) {
          const ang = (a / 32) * Math.PI * 2;
          shell.push(P(Math.cos(ang) * 300, Math.sin(ang) * 215));
        }
        lines.push(shell);
        const inner = shell.map((p) => P(p.x * 0.5, p.y * 0.5));
        lines.push(inner);
        for (const [x, y] of [[170, -190], [170, 190], [-170, -170], [-170, 170]]) {
          lines.push([P(x, y * 0.8), P(x - 70, y + Math.sign(y) * 70), P(x - 150, y + Math.sign(y) * 40)]);
        }
        lines.push([P(300, 0), P(360, 0)]);
        nodes.push(P(370, 0), ...shell.filter((_, k) => k % 4 === 0));
        break;
      }
      default:
        nodes.push(P(0, 0));
    }
    return { lines, nodes, eyes: B.eyes && B.eyes.length ? B.eyes.map(([x, y]) => P(x, y)) : [P(0, 0)] };
  }

  // Peint un colosse en constellation. opts : { angle, alpha, gold (0 → 1), eyes (0 → 1), time, seals (0 → 1) }.
  function colossus(g, d, x, y, scale, opts) {
    const o = opts || {};
    const { ctx } = g;
    const tint = mix(d.tint, GOLD, o.gold || 0);
    const f = figure(d, o.time === undefined ? g.time : o.time);
    const cos = Math.cos(o.angle || 0), sin = Math.sin(o.angle || 0);
    const at = (p) => ({ x: x + (p.x * cos - p.y * sin) * scale, y: y + (p.x * sin + p.y * cos) * scale });
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.globalCompositeOperation = 'lighter';
    dot(g, tint, x, y, 360 * scale, 0.12 * alpha);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const l of f.lines) {
      const pts = l.map(at);
      ctx.globalAlpha = 0.08 * alpha;
      ctx.strokeStyle = rgb(tint);
      ctx.lineWidth = Math.max(2, 16 * scale);
      path(ctx, pts);
      ctx.stroke();
      ctx.globalAlpha = 0.6 * alpha;
      ctx.lineWidth = Math.max(1, 2.2 * scale);
      path(ctx, pts);
      ctx.stroke();
    }
    for (const n of f.nodes) {
      const p = at(n);
      dot(g, tint, p.x, p.y, Math.max(3, 14 * scale), 0.7 * alpha);
    }
    // Ses sceaux : des points d'or (ou des éclats qui volent, quand ils se brisent).
    if (o.seals) {
      d.seals.forEach((s, i) => {
        const local = sealPoint(d, s.at, f);
        const p = at(local);
        dot(g, GOLD, p.x, p.y, 40 * scale * (0.6 + 0.4 * Math.sin(g.time * 4 + i)), o.seals * alpha);
      });
    }
    // Ses yeux.
    if (o.eyes) {
      for (const e of f.eyes) {
        const p = at(e);
        dot(g, [255, 255, 255], p.x, p.y, 16 * scale * (1 + o.eyes), o.eyes * alpha);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Position locale d'un sceau sur la figure.
  function sealPoint(d, at, f) {
    const B = Vide.Colossus.BODIES[d.body];
    if (at.startsWith('seg:')) return { x: -Number(at.slice(4)) * B.spacing, y: 0 };
    if (at.startsWith('core:')) {
      const k = Number(at.slice(5));
      const a = (k / (B.nuclei || 4)) * Math.PI * 2;
      return { x: Math.cos(a) * (B.orbit || 90) * (k === 0 ? 0.4 : 1), y: Math.sin(a) * (B.orbit || 90) * (k === 0 ? 0.4 : 1) };
    }
    const p = B.points && B.points[at];
    if (p === 'tail') return f.lines[0][f.lines[0].length - 3] || { x: -200, y: 0 };
    return p ? { x: p[0], y: p[1] } : { x: 0, y: 0 };
  }

  // Taille à laquelle peindre un colosse pour qu'il occupe `part` de la hauteur de l'écran.
  function fit(g, d, part) {
    const B = Vide.Colossus.BODIES[d.body];
    return (g.h * part) / (B.extent * 2);
  }

  // --- Registre ---

  const SCENES = {};

  function register(id, scene) {
    SCENES[id] = scene;
  }

  // Un tableau par son identifiant ('ouverture', 'rencontre:veilleur'…), ou null.
  function get(id) {
    if (SCENES[id]) return SCENES[id];
    const [kind, arg] = id.split(':');
    const make = SCENES[kind + ':'];
    if (!make || !arg || !Vide.COLOSSI.some((d) => d.id === arg)) return null;
    return make(Vide.Colossus.def(arg));
  }

  // Son nom, dans le menu.
  function title(id) {
    const [kind, arg] = id.split(':');
    const names = { ouverture: 'L’ouverture', rencontre: 'Rencontre', apaisement: 'Apaisement', renaissance: 'Renaissance', epilogue: 'Épilogue' };
    const name = names[kind] || kind;
    return arg ? `${name} · ${Vide.Colossus.def(arg).name}` : name;
  }

  // Les tableaux vus, dans l'ordre du récit.
  function seen(state) {
    const order = ['ouverture'];
    for (const d of Vide.COLOSSI) order.push('rencontre:' + d.id, 'apaisement:' + d.id);
    order.push('renaissance', 'epilogue');
    return order.filter((id) => state.cinematics.includes(id) && get(id));
  }

  Vide.Scenes = {
    GOLD, BLUE, glow, rgb, mix, ease, clamp01, rand, dot, path, stars, figure, colossus, fit, register, get, title, seen,
  };
})(globalThis.Vide);
