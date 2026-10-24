(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { State, Catalog, Wallet, TABS, UPGRADES } = Vide;

  test('Wallet : vérifier, payer, afficher un coût', () => {
    const state = State.create(1);
    state.light = 100;
    assert.ok(Wallet.has(state, { light: 100 }));
    assert.equal(Wallet.has(state, { light: 101 }), false);
    assert.equal(Wallet.pay(state, { light: 101 }), false);
    assert.equal(state.light, 100);
    assert.ok(Wallet.pay(state, { light: 40 }));
    assert.equal(state.light, 60);
    assert.equal(Wallet.format({ light: 1234 }), '✦ 1,23k');
  });

  test('chaque amélioration est inscrite au catalogue dans un onglet existant', () => {
    const tabIds = new Set(TABS.map((t) => t.id));
    for (const up of UPGRADES) {
      const item = Catalog.get(up.id);
      assert.ok(tabIds.has(item.tab), `${up.id} : onglet ${item.tab}`);
    }
    for (const item of Catalog.all()) assert.ok(tabIds.has(item.tab), `${item.id} : onglet ${item.tab}`);
  });

  test('acheter par le catalogue paie et applique', () => {
    const state = State.create(1);
    state.light = 1000;
    state.totalLight = 1000;
    assert.ok(Catalog.buy(state, 'reach'));
    assert.equal(state.upgrades.reach, 1);
    assert.equal(state.light, 1000 - Vide.Economy.get('reach').baseCost);
  });

  test("le catalogue refuse un achat trop cher sans rien modifier", () => {
    const state = State.create(1);
    state.light = 3;
    assert.equal(Catalog.buy(state, 'reach'), false);
    assert.equal(state.light, 3);
    assert.deepEqual(state.upgrades, {});
  });

  test("seuls les onglets ayant un article visible sont proposés", () => {
    const state = State.create(1);
    assert.deepEqual(Catalog.tabs(state), []);
    state.totalLight = 10;
    assert.deepEqual(Catalog.tabs(state).map((t) => t.id), ['lumiere']);
  });

  test('un identifiant en double est refusé', () => {
    assert.throws(() => Catalog.register({ id: 'reach', tab: 'lumiere' }));
  });

  test('un article inconnu est refusé clairement', () => {
    assert.throws(() => Catalog.get('nexistepas'));
  });
})();
