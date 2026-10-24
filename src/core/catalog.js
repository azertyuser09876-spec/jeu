// Catalogue de tout ce qui s'achète, rangé par onglets, puis par sections. L'interface l'affiche sans rien savoir
// de ce que chaque achat fait : améliorations, villages, êtres, bâtiments… s'y enregistrent tous.
// Onglets : 'village' (ce qui s'achète dans le village où l'on se trouve, et seulement là), 'fonder' (hors des
// villages), 'lumiere' (ta lumière), 'monde' (ce qui vaut pour tous tes villages), 'souvenirs'.
//
// Un article :
//   id, tab, name, desc
//   group            section dans l'onglet (voir GROUPS), facultatif
//   revealed(state)  visible dans l'interface ?
//   maxed(state)     plus rien à acheter ?
//   cost(state)      coût du prochain achat, ex. { light: 120 }
//   blocked(state)   raison empêchant l'achat (texte court) ou null
//   apply(state)     effet de l'achat (le coût est déjà payé)
//   label(state)     texte de niveau / quantité ("niv. 3", "4/6"…)
//   effect(state)    texte d'effet ("60 → 71")
//   confirm(state)   si présent : question posée avant l'achat (achat irréversible)
(function (Vide) {
  'use strict';

  Vide.TABS = [
    { id: 'village', name: 'village' },
    { id: 'fonder', name: 'fonder' },
    { id: 'lumiere', name: 'lumière' },
    { id: 'monde', name: 'monde' },
    { id: 'souvenirs', name: 'souvenirs' },
  ];

  // Les sections, dans leur ordre (un article sans section passe en tête de son onglet).
  Vide.GROUPS = ['êtres', 'créatures', 'armée', 'économie', 'vie', 'savoir', 'défense', 'cité', 'routes', 'territoires'];

  const items = [];
  const byId = new Map();

  const DEFAULTS = {
    order: 0, // ordre d'affichage dans l'onglet (plus petit = plus haut), puis ordre d'inscription
    revealed: () => true,
    maxed: () => false,
    blocked: () => null,
    label: () => '',
    effect: () => '',
  };

  function register(item) {
    if (byId.has(item.id)) throw new Error(`Article déjà enregistré : ${item.id}`);
    const full = { ...DEFAULTS, ...item, index: items.length };
    full.rank = (full.group ? Vide.GROUPS.indexOf(full.group) + 1 : 0) * 10000 + full.order;
    // Ce qui s'achète dans un village ne se montre que dans un village.
    if (full.tab === 'village') {
      const revealed = full.revealed;
      full.revealed = (state) => Boolean(Vide.Villages && Vide.Villages.current(state)) && revealed(state);
    }
    items.push(full);
    items.sort((a, b) => a.rank - b.rank || a.index - b.index);
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
