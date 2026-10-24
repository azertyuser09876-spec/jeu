// Simulation : fait avancer le monde d'un pas de temps. Aucune dépendance au navigateur.
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // Entrée attendue par step() : move = direction souhaitée, de longueur 0 à 1.
  function emptyInput() {
    return { move: { x: 0, y: 0 } };
  }

  function create(state) {
    const game = {
      state,
      stats: Vide.Stats.compute(state),
      field: Vide.Field.create(state.seed),
      velocity: { x: 0, y: 0 },
      time: 0,
      rate: 0,   // lumière par seconde, lissée sur quelques secondes
      glow: 0,   // éclat bref de la lumière après une récolte (0 à 1), purement visuel
    };
    Vide.Field.fill(game.field, state.player.x, state.player.y, game.stats);
    return game;
  }

  function movePlayer(game, dt, move) {
    const { player } = game.state;
    const v = game.velocity;
    const speed = game.stats.speed;
    const k = util.damp(CONFIG.player.acceleration, dt);
    v.x += (move.x * speed - v.x) * k;
    v.y += (move.y * speed - v.y) * k;
    player.x += v.x * dt;
    player.y += v.y * dt;
  }

  function gainLight(game, amount) {
    game.state.light += amount;
    game.state.totalLight += amount;
  }

  function step(game, dt, input) {
    const { state } = game;
    game.stats = Vide.Stats.compute(state);
    game.time += dt;
    state.stats.playTime += dt;

    movePlayer(game, dt, input.move);

    const harvest = Vide.Field.update(game.field, state.player, game.stats, dt);
    const gained = harvest.value * game.stats.value;
    if (harvest.count) {
      gainLight(game, gained);
      state.stats.collected += harvest.count;
      game.glow = Math.min(1, game.glow + 0.25 * harvest.count);
    }
    game.glow *= 1 - util.damp(4, dt);
    game.rate += (gained / dt - game.rate) * util.damp(1 / 3, dt);
  }

  Vide.Sim = { create, step, emptyInput, gainLight };
})(globalThis.Vide);
