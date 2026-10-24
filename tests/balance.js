// Robot d'équilibrage : `node tests/balance.js [minutes]`.
// Joue une partie simulée (marche aléatoire douce, pulsation dès qu'elle est prête, achète toujours
// l'amélioration la moins chère) et affiche la progression. Sert à vérifier le rythme après un réglage.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const minutes = Number(process.argv[2]) || 20;
const html = fs.readFileSync(path.join(__dirname, 'tests.html'), 'utf8');
const context = vm.createContext({ console });
for (const m of html.matchAll(/<script src="(\.\.\/src\/core\/[^"]+)"><\/script>/g)) {
  const file = path.resolve(__dirname, m[1]);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const { Vide } = context;
const { CONFIG, Economy, Sim, State, UPGRADES, util } = Vide;

const random = util.rng(7);
const state = State.create(7);
const game = Sim.create(state);
const input = Sim.emptyInput();
const dt = CONFIG.step;
const stepsPerMinute = Math.round(60 / dt);
let angle = 0;
let firstBuy = null;

for (let s = 1; s <= minutes * stepsPerMinute; s++) {
  if (s % 180 === 0) angle += (random() - 0.5) * 2.2;
  input.move.x = Math.cos(angle);
  input.move.y = Math.sin(angle);
  input.pulse = true;
  Sim.step(game, dt, input);

  if (s % 30 === 0) {
    const affordable = UPGRADES.map((u) => u.id)
      .filter((id) => Economy.canBuy(state, id))
      .sort((a, b) => Economy.nextCost(state, a) - Economy.nextCost(state, b));
    if (affordable.length) {
      Economy.buy(state, affordable[0]);
      if (firstBuy === null) firstBuy = game.time;
    }
  }

  if (s % (2 * stepsPerMinute) === 0) {
    const levels = UPGRADES.map((u) => `${u.id} ${Economy.level(state, u.id)}`).join(', ');
    console.log(
      `${String(s / stepsPerMinute).padStart(3)} min  total ${util.formatNumber(state.totalLight).padEnd(6)}` +
        `  débit ${util.formatRate(game.rate).padEnd(6)}/s  ${levels}`
    );
  }
}
console.log(`premier achat après ${firstBuy === null ? '—' : firstBuy.toFixed(1) + ' s'}`);
