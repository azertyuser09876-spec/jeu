(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Sim } = Vide;

  function newGame() {
    return Sim.create(State.create(1));
  }

  function run(game, seconds, input) {
    const steps = Math.round(seconds / CONFIG.step);
    for (let i = 0; i < steps; i++) Sim.step(game, CONFIG.step, input);
  }

  function moving(x, y) {
    const input = Sim.emptyInput();
    input.move.x = x;
    input.move.y = y;
    return input;
  }

  test('sans entrée, la lumière reste immobile', () => {
    const game = newGame();
    run(game, 2, Sim.emptyInput());
    assert.equal(game.state.player.x, 0);
    assert.equal(game.state.player.y, 0);
  });

  test('la lumière avance dans la direction demandée', () => {
    const game = newGame();
    run(game, 1, moving(1, 0));
    assert.ok(game.state.player.x > 50, `x = ${game.state.player.x}`);
    assert.near(game.state.player.y, 0, 1e-9);
  });

  test('la vitesse tend vers la vitesse de base sans la dépasser', () => {
    const game = newGame();
    let max = 0;
    for (let i = 0; i < 300; i++) {
      Sim.step(game, CONFIG.step, moving(0, -1));
      max = Math.max(max, Math.hypot(game.velocity.x, game.velocity.y));
    }
    assert.ok(max <= game.stats.speed + 1e-9, `max = ${max}`);
    assert.near(max, game.stats.speed, 1);
  });

  test('la lumière freine une fois la direction relâchée', () => {
    const game = newGame();
    run(game, 2, moving(1, 0));
    run(game, 3, Sim.emptyInput());
    assert.ok(Math.hypot(game.velocity.x, game.velocity.y) < 1);
  });

  test('le temps de jeu est compté', () => {
    const game = newGame();
    run(game, 2, Sim.emptyInput());
    assert.near(game.state.stats.playTime, 2, 0.02);
  });
})();
