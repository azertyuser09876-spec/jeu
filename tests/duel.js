// Le duelliste : `node tests/duel.js [colosse]`. Un robot affronte chaque colosse, dans l'ordre, avec ce qu'un
// joueur possède à peu près quand ce colosse s'éveille (améliorations, armée en escorte, sceaux étudiés, les
// colosses précédents apaisés). Il esquive les attaques annoncées, va vers le sceau actif et pulse au bon moment
// (cloche ouverte, oiseau au sol, debout sur le Dormeur…). Il n'a ni engins ni chaînes : c'est le cas le plus dur.
// Affiche, pour chacun : durée du combat, pulsations, dégâts encaissés, dispersions, mises à genou.
// Sert à vérifier qu'aucun colosse n'est impossible, et à régler leur difficulté.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const only = process.argv[2];
const html = fs.readFileSync(path.join(__dirname, 'tests.html'), 'utf8');
const context = vm.createContext({ console });
for (const m of html.matchAll(/<script src="(\.\.\/src\/core\/[^"]+)"><\/script>/g)) {
  const file = path.resolve(__dirname, m[1]);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const { Vide } = context;
const { CONFIG, Sim, State, Villages, Territory, Colossus } = Vide;
const dt = CONFIG.step;
const LIMIT = 15 * 60; // au-delà, le combat est jugé impossible

// Ce qu'on possède à peu près quand chaque colosse s'éveille.
const KIT = {
  veilleur: { up: { pulse: 8, scorch: 4, edge: 2, dash: 1, speed: 6 }, army: { gardien: 6, etincelle: 3, veilleuse: 1 } },
  tisseuse: { up: { pulse: 12, scorch: 7, edge: 4, dash: 2, speed: 10 }, army: { gardien: 10, etincelle: 5, veilleuse: 2, harponneur: 1 } },
  oiseau: { up: { pulse: 12, scorch: 7, edge: 4, dash: 2, speed: 10 }, army: { gardien: 10, etincelle: 5, veilleuse: 2, harponneur: 2 } },
  leviathan: { up: { pulse: 15, scorch: 10, edge: 6, dash: 3, speed: 14 }, army: { gardien: 14, etincelle: 7, veilleuse: 3, harponneur: 3 } },
  meduse: { up: { pulse: 17, scorch: 12, edge: 8, dash: 3, speed: 16 }, army: { gardien: 18, etincelle: 9, veilleuse: 4, harponneur: 4 } },
  nuee: { up: { pulse: 18, scorch: 14, edge: 10, dash: 3, speed: 18 }, army: { gardien: 20, etincelle: 10, veilleuse: 5, harponneur: 5 } },
  dormeur: { up: { pulse: 20, scorch: 16, edge: 12, dash: 3, speed: 20 }, army: { gardien: 24, etincelle: 12, veilleuse: 6, harponneur: 6 } },
};

function norm(x, y) {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
}

// Distance de (x, y) au segment [a, b].
function toSegment(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { d: Math.hypot(a.x + dx * t - x, a.y + dy * t - y), px: a.x + dx * t, py: a.y + dy * t };
}

// Direction pour fuir le danger de l'attaque en cours, ou null si l'on est hors de portée.
function escape(game, c) {
  const atk = c.attack;
  if (!atk) return null;
  const { player } = game.state;
  const A = Colossus.ATTACKS;
  const away = (x, y) => norm(player.x - x, player.y - y);
  const margin = 60;
  switch (atk.kind) {
    case 'stomp': case 'feathers': {
      const p = atk.points.find((q) => Math.hypot(player.x - q.x, player.y - q.y) < atk.radius + margin);
      return p ? away(p.x, p.y) : null;
    }
    case 'web': case 'volley': {
      const list = atk.webs || [atk.at];
      const p = list.find((q) => Math.hypot(player.x - q.x, player.y - q.y) < atk.radius + margin);
      return p ? away(p.x, p.y) : null;
    }
    case 'breath': case 'gale': case 'sweep': {
      const wide = atk.kind === 'sweep' ? { ...atk, dir: (atk.from + atk.to) / 2, spread: Math.abs(atk.to - atk.from) / 2 + atk.spread } : atk;
      if (!Colossus.inCone({ ...wide, length: wide.length + margin, spread: wide.spread + 0.15 }, player.x, player.y)) return null;
      // De côté, par rapport à l'axe du cône — ou en reculant hors de portée.
      const side = Math.sin(Math.atan2(player.y - atk.origin.y, player.x - atk.origin.x) - wide.dir) >= 0 ? 1 : -1;
      return { x: Math.cos(wide.dir + side * Math.PI / 2), y: Math.sin(wide.dir + side * Math.PI / 2) };
    }
    case 'charge': case 'dive': {
      const a = atk.origin;
      const b = { x: a.x + Math.cos(atk.dir) * atk.length, y: a.y + Math.sin(atk.dir) * atk.length };
      const s = toSegment(player.x, player.y, a, b);
      const w = (atk.kind === 'dive' ? A.dive.width : atk.width) * c.def.size;
      return s.d < w + margin ? away(s.px, s.py) : null;
    }
    case 'lash': {
      for (const l of atk.lines) {
        const s = toSegment(player.x, player.y, l.a, l.b);
        if (s.d < A.lash.width + margin) return away(s.px, s.py);
      }
      return null;
    }
    case 'quake': {
      const d = Math.hypot(player.x - atk.origin.x, player.y - atk.origin.y);
      if (d > atk.length + margin || (atk.phase === 'active' && d < atk.ring - A.quake.band)) return null;
      const angle = Math.atan2(player.y - atk.origin.y, player.x - atk.origin.x);
      if (Colossus.inGap(atk, angle)) return { x: 0, y: 0 }; // dans une brèche : ne plus bouger
      // Glisser vers la brèche la plus proche.
      let best = atk.gaps[0], bestD = Infinity;
      for (const g of atk.gaps) {
        let diff = g - angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < bestD) {
          bestD = Math.abs(diff);
          best = g;
        }
      }
      return norm(atk.origin.x + Math.cos(best) * d - player.x, atk.origin.y + Math.sin(best) * d - player.y);
    }
    case 'rush':
      return Math.hypot(player.x - atk.at.x, player.y - atk.at.y) < 260 ? away(atk.at.x, atk.at.y) : null;
    case 'vortex':
      return Math.hypot(player.x - atk.at.x, player.y - atk.at.y) < A.vortex.from + margin ? away(atk.at.x, atk.at.y) : null;
    default:
      return null;
  }
}

function duel(d) {
  const kit = KIT[d.id];
  const state = State.create(11);
  state.player.x = 0;
  state.player.y = 0;
  const v = Villages.found(state, 'bastion');
  v.area = Math.PI * 600 * 600;
  v.cells = [];
  Territory.grow(v);
  Object.assign(v.beings, kit.army);
  Object.assign(state.upgrades, kit.up);
  state.stats.shadows = 1000;
  state.light = state.totalLight = 1e9;
  for (const o of Vide.COLOSSI) {
    state.studied[o.id] = o.seals.length;
    if (Vide.COLOSSI.indexOf(o) < Vide.COLOSSI.indexOf(d) && !(d.id === 'oiseau' && ['tisseuse', 'leviathan'].includes(o.id))) {
      state.colossi[o.id] = 'tamed';
    }
  }
  // Prérequis exacts (l'Oiseau ne demande que le Veilleur ; la Méduse, l'Oiseau et la Tisseuse…).
  for (const o of Vide.COLOSSI) if (o !== d && !d.requires(state)) state.colossi[o.id] = 'tamed';
  state.colossi[d.id] = 'heard';
  Vide.Combat.setPosture(state, 'escorte');

  const game = Sim.create(state);
  game.field.particles.length = 0;
  const input = Sim.emptyInput();
  Sim.step(game, dt, input);
  const c = game.colossi.find((k) => k.id === d.id);
  // On arrive près de lui, l'armée avec soi.
  const start = { x: c.x + 900, y: c.y };
  state.player.x = start.x;
  state.player.y = start.y;
  for (const b of game.colony.beings) {
    b.x = start.x + (Math.random() - 0.5) * 100;
    b.y = start.y + (Math.random() - 0.5) * 100;
  }

  let damage = 0, deaths = 0, pulses = 0, kneels = 0;
  const hurt = Vide.Combat.hurtPlayer;
  Vide.Combat.hurtPlayer = (g, amount, x, y) => {
    if (g.vitality.invulnerable <= 0) damage += amount;
    return hurt(g, amount, x, y);
  };
  let t = 0;
  while (t < LIMIT && state.colossi[d.id] !== 'tamed') {
    const { player } = state;
    // Dispersée : on revient vers lui, l'armée aussi.
    if (game.events.some((e) => e.type === 'dispersed')) {
      deaths++;
      player.x = start.x;
      player.y = start.y;
      for (const b of game.colony.beings) {
        b.x = start.x;
        b.y = start.y;
      }
    }
    if (game.events.some((e) => e.type === 'kneel')) kneels++;
    game.events.length = 0;

    const flee = escape(game, c);
    const seal = Colossus.sealPos(c);
    input.move.x = input.move.y = 0;
    if (flee) {
      input.move.x = flee.x;
      input.move.y = flee.y;
      // Une ruée quand le coup est sur le point de tomber.
      const a = c.attack;
      if (a && a.phase === 'telegraph' && a.t > (a.telegraph || Colossus.ATTACKS[a.kind].telegraph) - 0.35) input.dash = true;
    } else if (seal) {
      const dx = seal.x - player.x, dy = seal.y - player.y;
      const dist = Math.hypot(dx, dy);
      const reach = game.stats.pulseRadius * 0.8;
      if (dist > reach * 0.6) {
        const n = norm(dx, dy);
        input.move.x = n.x;
        input.move.y = n.y;
      }
      const guard = Colossus.beast(c).guard;
      const open = !guard || !guard(game, c);
      if (dist < reach && open && Sim.pulseReady(game)) {
        input.pulse = true;
        pulses++;
      }
    }
    Sim.step(game, dt, input);
    t += dt;
  }
  Vide.Combat.hurtPlayer = hurt;
  return { id: d.id, tamed: state.colossi[d.id] === 'tamed', t, pulses, damage, deaths, kneels };
}

console.log('colosse      apaisé   durée   pulsations  dégâts  dispersions  à genou');
for (const d of Vide.COLOSSI) {
  if (only && d.id !== only) continue;
  const r = duel(d);
  const time = `${Math.floor(r.t / 60)} min ${String(Math.round(r.t % 60)).padStart(2, '0')}`;
  console.log(`${r.id.padEnd(12)} ${(r.tamed ? 'oui' : 'NON').padEnd(8)} ${time.padEnd(10)} ${String(r.pulses).padEnd(11)} `
    + `${String(Math.round(r.damage)).padEnd(7)} ${String(r.deaths).padEnd(12)} ${r.kneels}`);
}
