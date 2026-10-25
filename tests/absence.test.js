(function () {
  'use strict';
  const { test, assert, village } = VideTest;
  const { CONFIG, State, Nests, War, Fronts, Absence, Offline, Territory, Structures } = Vide;

  // Un village bâti ; contre lui, une base mûre et riche ; la guerre au plus fort.
  function world(beings) {
    const state = State.create(17);
    const v = village(state, { radius: 400, beings: beings || {} });
    for (const id of ['prisme', 'phare', 'fontaine']) {
      Structures.plan(state, v, id);
    }
    for (const b of v.buildings) b.work = Structures.def(b.type).work;
    const nest = Nests.add(state, 680, 0, CONFIG.nests.levelEvery * 5);
    nest.funds = 1e6;
    return { state, v, nest };
  }

  const openWar = (state) => {
    War.begin(state);
    state.war.age = 1e5;
  };

  test('sans guerre ouverte, l’absence n’est pas une guerre ; ouverte, ses fronts bougent pendant ton absence', () => {
    const quiet = world();
    const none = Absence.war(quiet.state, 3600);
    assert.deepEqual(none.taken, { light: 0, shadow: 0 });
    assert.equal(none.raids.broken + none.raids.repelled, 0);
    const { state, v } = world();
    openWar(state);
    const cells = v.cells.length;
    const r = Absence.war(state, 1800);
    assert.ok(r.taken.shadow > 0, 'les ombres ont mordu');
    assert.equal(v.cells.length / 3, cells / 3 - r.taken.shadow + r.taken.light);
    assert.equal(state.war.age, 1e5, 'l’âge de la guerre est rendu');
  });

  test('un assaut contre un village sans défense éteint des bâtiments ; contre une garnison, il est repoussé (des échos)', () => {
    const weak = world();
    openWar(weak.state);
    const r = Absence.war(weak.state, 1200);
    assert.ok(r.raids.broken > 0 && r.broken.length > 0);
    assert.ok(weak.v.buildings.some((b) => b.broken));
    // (La noirceur répond à la lumière : il faut une vraie garnison pour la repousser.)
    const strong = world({ gardien: 120 });
    openWar(strong.state);
    const echoes = strong.state.echoes;
    const s = Absence.war(strong.state, 1200);
    assert.ok(s.raids.repelled > 0 && s.raids.broken === 0);
    assert.ok(strong.state.echoes > echoes && s.echoes > 0);
    assert.ok(Absence.defense(strong.v) > Absence.weight(strong.state, strong.nest, strong.v));
    assert.ok(Absence.weight(strong.state, strong.nest, strong.v) > Absence.weight(strong.state, strong.nest, weak.v),
      'plus l’armée est grande, plus l’assaut l’est');
  });

  test('une campagne continue pendant l’absence : une armée forte abat sa base, une faible rentre', () => {
    const strong = world({ gardien: 30 });
    openWar(strong.state);
    strong.v.campaign = strong.nest.id;
    const r = Absence.war(strong.state, 3600);
    assert.deepEqual(r.fallen, ['jardins']);
    assert.ok(!strong.state.nests.includes(strong.nest));
    assert.equal(strong.v.campaign, null);
    const weak = world({ gardien: 4 });
    openWar(weak.state);
    weak.nest.age = CONFIG.nests.levelEvery * 7;
    weak.nest.hp = Nests.maxHp(weak.nest);
    weak.v.campaign = weak.nest.id;
    const w = Absence.war(weak.state, 3600);
    assert.deepEqual(w.retreats, ['jardins']);
    assert.ok(weak.state.nests.includes(weak.nest));
    assert.ok(weak.v.beings.gardien < CONFIG.governors.campaignRetreat);
  });

  test('pendant une longue absence, les ombres peuvent prendre un colosse apaisé ; l’écran du retour le dit', () => {
    const { state } = world({ gardien: 40 });
    state.colossi.veilleur = 'tamed';
    openWar(state);
    const at = Vide.Colossus.home(state, Vide.Colossus.def('veilleur'));
    Nests.add(state, at.x + 1500, at.y, CONFIG.nests.levelEvery * 6);
    const report = Offline.apply(state, 4 * 3600);
    assert.ok(report.battle.corrupted.includes('veilleur'));
    assert.equal(state.colossi.veilleur, 'corrupted');
    assert.ok(Offline.worthShowing(report));
  });
})();
