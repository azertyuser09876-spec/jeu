// Point d'entrée : relie la simulation, l'affichage et les contrôles, et fait tourner la boucle.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  const canvas = document.getElementById('view');
  const renderer = Vide.Render.create(canvas);
  window.addEventListener('resize', () => Vide.Render.resize(renderer));

  const state = Vide.State.create((Math.random() * 2 ** 32) >>> 0);
  const game = Vide.Sim.create(state);
  const input = Vide.Input.create(canvas);
  const ui = Vide.UI.create(game);
  Vide.Render.snapCamera(renderer, game);

  // Touches d'action (en plus du déplacement). Renvoie vrai si la touche a été utilisée.
  input.onAction = (code) => {
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (digit) return Vide.UI.buyByIndex(ui, Number(digit[1]));
    return false;
  };

  // Accès depuis la console du navigateur, pratique pour déboguer.
  Vide.game = game;

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    // Au retour d'un onglet en arrière-plan, on ne rattrape pas des minutes de simulation d'un coup.
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;

    accumulator += dt;
    let steps = 0;
    while (accumulator >= CONFIG.step && steps < CONFIG.maxStepsPerFrame) {
      Vide.Input.update(input, game, renderer);
      Vide.Sim.step(game, CONFIG.step, input);
      accumulator -= CONFIG.step;
      steps++;
    }
    if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;

    Vide.Render.draw(renderer, game, dt);
    Vide.UI.update(ui);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})(globalThis.Vide);
