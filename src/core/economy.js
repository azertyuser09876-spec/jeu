// Achat des améliorations : prix, conditions, effet sur l'état.
(function (Vide) {
  'use strict';

  function get(id) {
    const up = Vide.UPGRADES.find((u) => u.id === id);
    if (!up) throw new Error(`Amélioration inconnue : ${id}`);
    return up;
  }

  function level(state, id) {
    return state.upgrades[id] || 0;
  }

  function cost(up, lvl) {
    return Math.ceil(up.baseCost * Math.pow(up.growth, lvl));
  }

  function nextCost(state, id) {
    return cost(get(id), level(state, id));
  }

  function isMaxed(state, id) {
    const up = get(id);
    return up.max !== null && level(state, id) >= up.max;
  }

  function canBuy(state, id) {
    return !isMaxed(state, id) && state.light >= nextCost(state, id);
  }

  // Une amélioration se dévoile quand on approche de son prix, et ne disparaît plus ensuite.
  function isRevealed(state, id) {
    return level(state, id) > 0 || state.totalLight >= get(id).baseCost * 0.5;
  }

  function buy(state, id) {
    if (!canBuy(state, id)) return false;
    state.light -= nextCost(state, id);
    state.upgrades[id] = level(state, id) + 1;
    return true;
  }

  // Texte de l'effet au niveau actuel et au suivant, pour l'interface.
  function preview(state, id) {
    const up = get(id);
    const now = up.show(Vide.Stats.compute(state));
    if (isMaxed(state, id)) return { now, next: null };
    const next = { ...state, upgrades: { ...state.upgrades, [id]: level(state, id) + 1 } };
    return { now, next: up.show(Vide.Stats.compute(next)) };
  }

  Vide.Economy = { get, level, cost, nextCost, isMaxed, canBuy, isRevealed, buy, preview };
})(globalThis.Vide);
