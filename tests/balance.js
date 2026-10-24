// Robot d'équilibrage : `node tests/balance.js [minutes] [--renaissance]`.
// Avec --renaissance, il renaît dès que possible et compare le rythme de chaque vie.
// Joue une partie simulée (marche aléatoire douce, pulsation dès qu'elle est prête, achète toujours
// l'article le moins cher du catalogue, revient à l'origine quand un achat l'exige) et affiche la progression.
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
const { CONFIG, Catalog, Sim, State, Territory, Wallet, util } = Vide;

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
const events = { tide: 0, dispersed: 0, beingDown: 0, broken: 0, foyerAttacked: 0 };

// Coût total d'un article, toutes ressources confondues (approximation suffisante pour choisir).
const price = (item) => Object.values(item.cost(state)).reduce((a, b) => a + b, 0);

for (let s = 1; s <= minutes * stepsPerMinute; s++) {
  // Un achat qui attend le joueur à l'origine : on y retourne.
  const waiting = Catalog.all().find((i) => i.revealed(state) && !i.maxed(state) &&
    i.blocked(state) === 'rejoins l’origine' && Wallet.has(state, i.cost(state)));
  if (waiting) {
    const d = Math.hypot(state.player.x, state.player.y) || 1;
    input.move.x = -state.player.x / d;
    input.move.y = -state.player.y / d;
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
    const buyable = Catalog.all()
      .filter((i) => (reborn || i.id !== 'renaissance') && i.revealed(state) && Catalog.canBuy(state, i.id))
      .sort((a, b) => price(a) - price(b));
    if (buyable.length) {
      const item = buyable[0];
      Catalog.buy(state, item.id);
      if (!(item.id in firsts)) firsts[item.id] = game.time;
    }
  }

  if (s % (2 * stepsPerMinute) === 0) {
    const levels = Object.entries(state.upgrades).map(([k, v]) => `${k} ${v}`).join(', ');
    const territory = state.territory.lit ? `  territoire r=${Math.round(Territory.radius(state))}` : '';
    const beings = Object.entries(state.beings).map(([k, v]) => `${k} ${v}`).join(' ');
    const built = state.buildings.filter((x) => Vide.Structures.isDone(x)).map((x) => x.type[0]).join('');
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
