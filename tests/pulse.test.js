(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { CONFIG, State, Field, Sim } = Vide;
  const dt = CONFIG.step;

  function emptyGame() {
    const game = Sim.create(State.create(1));
    game.field.particles.length = 0;
    return game;
  }

  function run(game, seconds, input) {
    for (let i = 0; i < Math.round(seconds / dt); i++) Sim.step(game, dt, input || Sim.emptyInput());
  }

  test('la pulsation est prête dès le départ', () => {
    assert.ok(Sim.pulseReady(emptyGame()));
  });

  test("l'onde attrape les particules dans son rayon, pas au-delà", () => {
    const game = emptyGame();
    const r = game.stats.pulseRadius;
    const inside = Field.place(game.field, r - 10, 0, false, true);
    const outside = Field.place(game.field, 0, r + 40, false, true);
    assert.ok(Sim.pulse(game));
    run(game, 0.05);
    assert.equal(inside.caught, -1, "l'onde ne doit pas être instantanée");
    run(game, 1);
    assert.equal(outside.caught, -1);
    assert.ok(game.field.particles.indexOf(inside) === -1, 'la particule proche doit être récoltée');
    assert.equal(game.state.stats.collected, 1);
  });

  test('la pulsation doit se recharger avant de repartir', () => {
    const game = emptyGame();
    assert.ok(Sim.pulse(game));
    assert.equal(Sim.pulse(game), false);
    run(game, game.stats.pulseCooldown - 0.5);
    assert.equal(Sim.pulseReady(game), false);
    run(game, 0.6);
    assert.ok(Sim.pulseReady(game));
  });

  test("la demande de pulsation est consommée par la simulation", () => {
    const game = emptyGame();
    const input = Sim.emptyInput();
    input.pulse = true;
    Sim.step(game, dt, input);
    assert.equal(input.pulse, false);
    assert.ok(game.pulse.cooldown > 0);
  });

  test("l'onde se termine une fois sa portée atteinte", () => {
    const game = emptyGame();
    Sim.pulse(game);
    run(game, game.stats.pulseRadius / CONFIG.pulse.waveSpeed + 0.1);
    assert.equal(game.pulse.wave, -1);
  });

  test("l'amélioration agrandit l'onde et raccourcit la recharge", () => {
    const state = State.create(1);
    const before = Vide.Stats.compute(state);
    state.upgrades.pulse = 5;
    const after = Vide.Stats.compute(state);
    assert.ok(after.pulseRadius > before.pulseRadius);
    assert.ok(after.pulseCooldown < before.pulseCooldown);
  });
})();
