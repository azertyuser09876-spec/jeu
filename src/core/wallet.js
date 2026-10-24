// Ressources du joueur et coûts. Un coût est un objet { ressource: quantité }, par ex. { light: 120 }.
// Chaque ressource correspond à un champ numérique de l'état (state.light…).
(function (Vide) {
  'use strict';

  Vide.CURRENCIES = {
    light: { glyph: '✦', name: 'lumière' },
    echoes: { glyph: '◆', name: 'échos' },
    memories: { glyph: '✧', name: 'souvenirs' },
  };

  function has(state, cost) {
    for (const key in cost) {
      if ((state[key] || 0) < cost[key]) return false;
    }
    return true;
  }

  function pay(state, cost) {
    if (!has(state, cost)) return false;
    for (const key in cost) state[key] -= cost[key];
    return true;
  }

  // { light: 1234, echoes: 5 } → "✦ 1,23k · ◆ 5"
  function format(cost) {
    return Object.keys(cost)
      .filter((key) => cost[key] > 0)
      .map((key) => `${Vide.CURRENCIES[key].glyph} ${Vide.util.formatNumber(cost[key])}`)
      .join(' · ');
  }

  Vide.Wallet = { has, pay, format };
})(globalThis.Vide);
