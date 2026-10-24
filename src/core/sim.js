// Simulation : fait avancer le monde d'un pas de temps. Aucune dépendance au navigateur.
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // Entrée attendue par step() : move = direction souhaitée, de longueur 0 à 1.
  function emptyInput() {
    return { move: { x: 0, y: 0 } };
  }

  function create(state) {
    return {
      state,
      stats: Vide.Stats.compute(state),
      velocity: { x: 0, y: 0 },
      time: 0,
    };
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

  function step(game, dt, input) {
    game.stats = Vide.Stats.compute(game.state);
    game.time += dt;
    game.state.stats.playTime += dt;
    movePlayer(game, dt, input.move);
  }

  Vide.Sim = { create, step, emptyInput };
})(globalThis.Vide);
