// Améliorations : prix, conditions, achat. Chaque amélioration est aussi inscrite au catalogue.
(function (Vide) {
  'use strict';

  function get(id) {
    const up = Vide.UPGRADES.find((u) => u.id === id);
    if (!up) throw new Error(`Amélioration inconnue : ${id}`);
    return up;
  }

  // Les améliorations « héritées » (souvenirs) sont rangées à part : elles survivent aux renaissances.
  function store(state, up) {
    return up.legacy ? state.legacy : state.upgrades;
  }

  function level(state, id) {
    return store(state, get(id))[id] || 0;
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

  // Ressource dans laquelle se paie une amélioration (la lumière par défaut, les échos pour l'armée).
  function currency(up) {
    return up.currency || 'light';
  }

  function canBuy(state, id) {
    return isRevealed(state, id) && !isMaxed(state, id) && (state[currency(get(id))] || 0) >= nextCost(state, id);
  }

  // Une amélioration se dévoile quand ses conditions sont remplies et qu'on approche de son prix ;
  // elle ne disparaît plus ensuite.
  function isRevealed(state, id) {
    const up = get(id);
    if (level(state, id) > 0) return true;
    if (up.requires && !up.requires(state)) return false;
    // Une amélioration payée en échos ou en souvenirs se dévoile dès que ses conditions sont remplies.
    return currency(up) !== 'light' || state.totalLight >= up.baseCost * 0.5;
  }

  function buy(state, id) {
    if (!canBuy(state, id)) return false;
    state[currency(get(id))] -= nextCost(state, id);
    store(state, get(id))[id] = level(state, id) + 1;
    return true;
  }

  // Texte de l'effet au niveau actuel et au suivant, pour l'interface.
  function preview(state, id) {
    const up = get(id);
    const now = up.show(Vide.Stats.compute(state));
    if (isMaxed(state, id)) return { now, next: null };
    const next = up.legacy
      ? { ...state, legacy: { ...state.legacy, [id]: level(state, id) + 1 } }
      : { ...state, upgrades: { ...state.upgrades, [id]: level(state, id) + 1 } };
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
      cost: (state) => ({ [currency(up)]: nextCost(state, up.id) }),
      apply: (state) => { store(state, up)[up.id] = level(state, up.id) + 1; },
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

  Vide.Economy = { get, level, cost, nextCost, currency, isMaxed, canBuy, isRevealed, buy, preview };
})(globalThis.Vide);
