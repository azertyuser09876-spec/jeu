// Point d'entrée : relie la simulation, l'affichage et les contrôles, et fait tourner la boucle.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  const canvas = document.getElementById('view');
  const renderer = Vide.Render.create(canvas);
  window.addEventListener('resize', () => Vide.Render.resize(renderer));

  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    // Au retour d'un onglet en arrière-plan, on ne rattrape pas des minutes de simulation d'un coup.
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;

    accumulator += dt;
    let steps = 0;
    while (accumulator >= CONFIG.step && steps < CONFIG.maxStepsPerFrame) {
      accumulator -= CONFIG.step;
      steps++;
    }
    if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;

    Vide.Render.draw(renderer);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})(globalThis.Vide);
