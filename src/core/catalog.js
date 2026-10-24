// Catalogue de tout ce qui s'achète, rangé par onglets. L'interface l'affiche sans rien savoir
// de ce que chaque achat fait : améliorations, foyer, êtres, bâtiments… s'y enregistrent tous.
//
// Un article :
//   id, tab, name, desc
//   revealed(state)  visible dans l'interface ?
//   maxed(state)     plus rien à acheter ?
//   cost(state)      coût du prochain achat, ex. { light: 120 }
//   blocked(state)   raison empêchant l'achat (texte court) ou null
//   apply(state)     effet de l'achat (le coût est déjà payé)
//   label(state)     texte de niveau / quantité ("niv. 3", "4/6"…)
//   effect(state)    texte d'effet ("60 → 71")
(function (Vide) {
  'use strict';

  Vide.TABS = [
    { id: 'lumiere', name: 'lumière' },
    { id: 'territoire', name: 'territoire' },
  ];

  const items = [];
  const byId = new Map();

  const DEFAULTS = {
    revealed: () => true,
    maxed: () => false,
    blocked: () => null,
    label: () => '',
    effect: () => '',
  };

  function register(item) {
    if (byId.has(item.id)) throw new Error(`Article déjà enregistré : ${item.id}`);
    const full = { ...DEFAULTS, ...item };
    items.push(full);
    byId.set(full.id, full);
    return full;
  }

  function get(id) {
    const item = byId.get(id);
    if (!item) throw new Error(`Article inconnu : ${id}`);
    return item;
  }

  function all() {
    return items;
  }

  function canBuy(state, id) {
    const item = get(id);
    return !item.maxed(state) && !item.blocked(state) && Vide.Wallet.has(state, item.cost(state));
  }

  function buy(state, id) {
    if (!canBuy(state, id)) return false;
    const item = get(id);
    Vide.Wallet.pay(state, item.cost(state));
    item.apply(state);
    return true;
  }

  function visible(state, tab) {
    return items.filter((i) => i.tab === tab && i.revealed(state));
  }

  // Onglets ayant au moins un article visible, dans l'ordre de Vide.TABS.
  function tabs(state) {
    return Vide.TABS.filter((t) => items.some((i) => i.tab === t.id && i.revealed(state)));
  }

  Vide.Catalog = { register, get, all, canBuy, buy, visible, tabs };
})(globalThis.Vide);
