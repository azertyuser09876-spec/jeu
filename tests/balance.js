// Robot d'équilibrage : `node tests/balance.js [minutes] [--renaissance]`.
// Avec --renaissance, il renaît dès que possible et compare le rythme de chaque vie.
// Joue une partie simulée (marche aléatoire douce, pulsation dès qu'elle est prête, achète toujours
// l'article le moins cher du catalogue ; rejoint un village quand un achat l'exige, s'en éloigne pour en
// fonder un autre) et affiche la progression.
// Sert à vérifier le rythme après un réglage.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const minutes = Number(process.argv[2]) || 20;
const reborn = process.argv.includes('--renaissance');
const html = fs.readFileSync(path.join(__dirname, 'tests.html'), 'utf8');
const context = vm.createContext({ console });
for (const m of html.matchAll(/<script src="(\.\.\/src\/core\/[^"]+)"><\/script>/g)) {
  const file = path.resolve(__dirname, m[1]);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const { Vide } = context;
const { CONFIG, Catalog, Sim, State, Territory, Villages, Wallet, util } = Vide;

const random = util.rng(7);
const state = State.create(7);
const game = Sim.create(state);
const input = Sim.emptyInput();
const dt = CONFIG.step;
const stepsPerMinute = Math.round(60 / dt);
let angle = 0;
const firsts = {};
// Chaque vie : quand elle atteint 1 M de lumière (depuis sa naissance).
const lives = [];
let lifeStart = 0;
let lifeMillion = null;
// Événements de combat comptés pendant la partie.
const events = { tide: 0, dispersed: 0, beingDown: 0, broken: 0, heartAttacked: 0 };

// Coût total d'un article, toutes ressources confondues (approximation suffisante pour choisir).
const price = (item) => Object.values(item.cost(state)).reduce((a, b) => a + b, 0);

// Achats qui attendent que le joueur se déplace : rejoindre un village, ou s'en éloigner pour en fonder un.
const JOIN = ['rejoins un village'];
const LEAVE = ['hors des villages', 'trop près d’un village'];
let waitCheck = 0;
let goal = null; // 'join' | 'leave' | null

function steerTo(x, y, sign) {
  const dx = x - state.player.x, dy = y - state.player.y;
  const d = Math.hypot(dx, dy) || 1;
  input.move.x = (sign * dx) / d;
  input.move.y = (sign * dy) / d;
}

for (let s = 1; s <= minutes * stepsPerMinute; s++) {
  if (--waitCheck <= 0) {
    waitCheck = 30;
    goal = null;
    // Les fondations ne se montrent que hors des villages : le robot les considère toujours.
    for (const i of Catalog.all()) {
      const cost = i.cost(state);
      if (i.id === 'intendant' || i.maxed(state) || !Object.keys(cost).length || !Wallet.has(state, cost)) continue;
      const founding = i.id.startsWith('village-');
      if (!founding && !i.revealed(state)) continue;
      const why = i.blocked(state);
      if (JOIN.includes(why) && !goal) goal = 'join';
      // Fonder (le premier village, ou le suivant quand on peut se l'offrir) passe avant tout.
      if (founding && (LEAVE.includes(why) || (Villages.current(state) && !why))) goal = 'leave';
    }
  }
  const home = Villages.nearest(state, state.player.x, state.player.y);
  if (goal === 'join' && home) {
    steerTo(home.x, home.y, 1);
  } else if (goal === 'leave' && home) {
    steerTo(home.x, home.y, -1);
  } else {
    if (s % 180 === 0) angle += (random() - 0.5) * 2.2;
    input.move.x = Math.cos(angle);
    input.move.y = Math.sin(angle);
  }
  input.pulse = true;
  Sim.step(game, dt, input);
  for (const e of game.events) if (e.type in events) events[e.type]++;
  game.events.length = 0;
  if (lifeMillion === null && state.totalLight - state.runStart >= 1e6) lifeMillion = game.time - lifeStart;
  if (state.renaissances > lives.length) {
    lives.push(`vie ${lives.length + 1} : 1 M en ${lifeMillion === null ? '—' : (lifeMillion / 60).toFixed(1) + ' min'}, renaissance à ${(game.time / 60).toFixed(1)} min (✧ ${state.memories})`);
    lifeStart = game.time;
    lifeMillion = null;
  }

  if (s % 30 === 0) {
    // Chaque village confie un quart de sa lumière à son intendant.
    for (const v of state.villages) if (!v.robot) { v.robot = true; v.steward = 0.25; }
    const buyable = Catalog.all()
      .filter((i) => (reborn || i.id !== 'renaissance') && i.id !== 'intendant' && i.revealed(state) && Catalog.canBuy(state, i.id))
      .sort((a, b) => price(a) - price(b));
    // Le type de village change à chaque fondation, pour les essayer tous.
    const founding = buyable.filter((i) => i.id.startsWith('village-'));
    const offset = Number(process.env.VILLAGE_OFFSET) || 0;
    if (founding.length) buyable.unshift(founding[(state.villages.length + offset) % founding.length]);
    if (buyable.length) {
      const item = buyable[0];
      Catalog.buy(state, item.id);
      if (!(item.id in firsts)) firsts[item.id] = game.time;
    }
  }

  if (s % (2 * stepsPerMinute) === 0) {
    const levels = Object.entries(state.upgrades).map(([k, v]) => `${k} ${v}`).join(', ');
    const territory = state.villages.length
      ? `  villages ${state.villages.map((v) => `${v.type[0]}${Math.round(Territory.radius(v))}`).join(' ')}` : '';
    const counts = {};
    for (const v of state.villages) for (const [k, n] of Object.entries(v.beings)) counts[k] = (counts[k] || 0) + n;
    const beings = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' ');
    const built = Vide.Structures.all(state).filter((x) => Vide.Structures.isDone(x)).map((x) => x.type[0]).join('');
    const colony = beings ? `  êtres [${beings}] bâtiments [${built}]` : '';
    const fights = state.tides ? `  marées ${state.tides} ombres ${state.stats.shadows} ◆${Math.round(state.echoes)} dispersé ${events.dispersed} éteints ${events.beingDown} cassés ${events.broken}` : '';
    console.log(
      `${String(s / stepsPerMinute).padStart(3)} min  total ${util.formatNumber(state.totalLight).padEnd(6)}` +
        `  débit ${util.formatRate(game.rate).padEnd(6)}/s${territory}${fights}${colony}  ${levels}`
    );
  }
}
if (reborn) for (const l of lives) console.log(l);
console.log('premiers achats : ' + Object.entries(firsts).map(([k, t]) => `${k} ${Math.round(t)} s`).join(', '));
