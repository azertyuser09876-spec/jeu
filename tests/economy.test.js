(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { State, Stats, Economy, UPGRADES } = Vide;

  test("le catalogue d'améliorations est cohérent", () => {
    const ids = new Set();
    for (const up of UPGRADES) {
      assert.ok(/^[a-z][a-zA-Z0-9]*$/.test(up.id), `identifiant invalide : ${up.id}`);
      assert.ok(!ids.has(up.id), `identifiant en double : ${up.id}`);
      ids.add(up.id);
      assert.ok(up.baseCost > 0 && up.growth > 1, `${up.id} : prix invalide`);
      assert.ok(up.max === null || up.max > 0, `${up.id} : max invalide`);
      assert.ok(typeof up.show === 'function' && Object.keys(up.effects).length, `${up.id} : effets manquants`);
    }
  });

  test('au niveau 0, les améliorations ne changent rien', () => {
    assert.deepEqual(Stats.compute(State.create(1)), Stats.base());
  });

  // Caractéristiques pour lesquelles « plus petit » est meilleur.
  const LOWER_IS_BETTER = new Set(['pulseCooldown']);

  test("chaque niveau améliore la caractéristique visée", () => {
    for (const up of UPGRADES) {
      for (const key in up.effects) {
        const state = State.create(1);
        const before = Stats.compute(state)[key];
        state.upgrades[up.id] = 3;
        const after = Stats.compute(state)[key];
        const better = LOWER_IS_BETTER.has(key) ? after < before : after > before;
        assert.ok(better, `${up.id} → ${key} : ${before} puis ${after}`);
      }
    }
  });

  test('le prix part du prix de base puis augmente', () => {
    const up = Economy.get('reach');
    assert.equal(Economy.cost(up, 0), up.baseCost);
    for (let l = 0; l < 20; l++) assert.ok(Economy.cost(up, l + 1) > Economy.cost(up, l));
  });

  test('impossible d\'acheter sans assez de lumière', () => {
    const state = State.create(1);
    state.light = 5;
    assert.equal(Economy.canBuy(state, 'reach'), false);
    assert.equal(Economy.buy(state, 'reach'), false);
    assert.equal(state.light, 5);
    assert.equal(Economy.level(state, 'reach'), 0);
  });

  test('acheter retire le prix et monte le niveau', () => {
    const state = State.create(1);
    state.light = 100;
    state.totalLight = 100;
    const price = Economy.nextCost(state, 'reach');
    assert.ok(Economy.buy(state, 'reach'));
    assert.equal(state.light, 100 - price);
    assert.equal(Economy.level(state, 'reach'), 1);
    assert.ok(Economy.nextCost(state, 'reach') > price);
  });

  test('impossible de dépasser le niveau maximal', () => {
    const state = State.create(1);
    const up = Economy.get('reach');
    state.upgrades.reach = up.max;
    state.light = 1e30;
    assert.ok(Economy.isMaxed(state, 'reach'));
    assert.equal(Economy.buy(state, 'reach'), false);
    assert.equal(Economy.preview(state, 'reach').next, null);
  });

  test("une amélioration encore cachée ne s'achète pas", () => {
    const state = State.create(1);
    state.light = 1000;
    assert.equal(Economy.canBuy(state, 'density'), false);
  });

  test("une amélioration sans maximum n'est jamais plafonnée", () => {
    const state = State.create(1);
    state.upgrades.value = 500;
    assert.equal(Economy.isMaxed(state, 'value'), false);
  });

  test('les améliorations se dévoilent en approchant de leur prix', () => {
    const state = State.create(1);
    assert.equal(Economy.isRevealed(state, 'reach'), false);
    state.totalLight = Economy.get('reach').baseCost / 2;
    assert.ok(Economy.isRevealed(state, 'reach'));
    assert.equal(Economy.isRevealed(state, 'density'), false);
  });

  test("l'aperçu montre la valeur actuelle et la suivante", () => {
    const state = State.create(1);
    const p = Economy.preview(state, 'reach');
    assert.equal(p.now, String(Math.round(Stats.base().reach)));
    assert.ok(Number(p.next) > Number(p.now));
  });

  test('une amélioration inconnue est refusée clairement', () => {
    assert.throws(() => Economy.get('nexistepas'));
  });

  // Garde-fou contre l'emballement : pour chaque source de revenu, les améliorations sans maximum
  // qui la multiplient doivent avoir Σ ln(multiplicateur par niveau) / ln(croissance du prix) < 1,
  // sinon le revenu grandit plus vite que les prix et la partie explose (vu au robot en 0.4).
  // Une nouvelle amélioration sans maximum doit être rattachée ici à la caractéristique qu'elle multiplie.
  const STREAMS = {
    champ: ['value'],
    etres: ['value', 'beingValue'],
    territoire: ['territoryYield'],
  };

  test("aucune combinaison d'améliorations illimitées ne fait exploser le revenu", () => {
    const state = State.create(1);
    for (const [stream, statKeys] of Object.entries(STREAMS)) {
      let sum = 0;
      for (const up of UPGRADES) {
        if (up.max !== null) continue;
        for (const key of statKeys) {
          if (!up.effects[key]) continue;
          const perLevel = up.effects[key](11) / up.effects[key](10);
          sum += Math.log(perLevel) / Math.log(up.growth);
        }
      }
      assert.ok(sum < 0.95, `${stream} : ${sum.toFixed(2)}`);
    }
    for (const up of UPGRADES) {
      if (up.max !== null) continue;
      const known = Object.values(STREAMS).some((keys) => Object.keys(up.effects).some((k) => keys.includes(k)));
      assert.ok(known, `${up.id} est illimitée : la rattacher à une source de revenu dans ce test`);
    }
    assert.ok(state);
  });

  test('formatMultiplier', () => {
    const { formatMultiplier } = Vide.util;
    assert.equal(formatMultiplier(1), '×1,00');
    assert.equal(formatMultiplier(1.4), '×1,40');
    assert.equal(formatMultiplier(12.345), '×12,3');
    assert.equal(formatMultiplier(1200), '×1,20k');
  });
})();
