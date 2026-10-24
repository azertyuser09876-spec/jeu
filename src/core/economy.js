// Améliorations : prix, conditions, achat. Chaque amélioration est aussi inscrite au catalogue.
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
    return isRevealed(state, id) && !isMaxed(state, id) && state.light >= nextCost(state, id);
  }

  // Une amélioration se dévoile quand ses conditions sont remplies et qu'on approche de son prix ;
  // elle ne disparaît plus ensuite.
  function isRevealed(state, id) {
    const up = get(id);
    if (level(state, id) > 0) return true;
    if (up.requires && !up.requires(state)) return false;
    return state.totalLight >= up.baseCost * 0.5;
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

  for (const up of Vide.UPGRADES) {
    Vide.Catalog.register({
      id: up.id,
      tab: up.tab || 'lumiere',
      name: up.name,
      desc: up.desc,
      revealed: (state) => isRevealed(state, up.id),
      maxed: (state) => isMaxed(state, up.id),
      cost: (state) => ({ light: nextCost(state, up.id) }),
      apply: (state) => { state.upgrades[up.id] = level(state, up.id) + 1; },
      label: (state) => {
        const l = level(state, up.id);
        return isMaxed(state, up.id) ? 'max' : l ? `niv. ${l}` : '';
      },
      effect: (state) => {
        const p = preview(state, up.id);
        return p.next ? `${p.now} → ${p.next}` : p.now;
      },
    });
  }

  Vide.Economy = { get, level, cost, nextCost, isMaxed, canBuy, isRevealed, buy, preview };
})(globalThis.Vide);
