// Contrôles : souris / doigt maintenu, ou clavier. Produit l'entrée attendue par Vide.Sim.step.
(function (Vide) {
  'use strict';
  const { util } = Vide;

  // e.code désigne la position physique de la touche : ZQSD (AZERTY) et WASD (QWERTY) fonctionnent.
  const KEYS = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  };

  // En dessous de cette distance (unités du monde) entre la lumière et le pointeur, on s'arrête ;
  // au-delà de SLOW_RADIUS on va à pleine vitesse.
  const DEAD_ZONE = 6;
  const SLOW_RADIUS = 60;

  function create(canvas) {
    const input = {
      move: { x: 0, y: 0 },
      pulse: false,
      pointer: { active: false, id: null, x: 0, y: 0 },
      touches: new Map(), // doigts posés sur le canvas (pour le pincement)
      pinch: 0,           // écart entre deux doigts au dernier événement (0 : pas de pincement)
      zoom: 1,            // facteur de zoom demandé depuis la dernière image (molette, pincement)
      keys: new Set(),
      onAction: null,   // rappel facultatif pour les touches d'action (pulsation, achats…)
    };

    // Molette : zoom.
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      input.zoom *= Math.exp(-e.deltaY * 0.0015);
    }, { passive: false });

    const spread = () => {
      const [a, b] = [...input.touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    canvas.addEventListener('pointerdown', (e) => {
      input.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Deux doigts : pincement pour zoomer, on cesse de se déplacer.
      if (input.touches.size === 2) {
        input.pointer.active = false;
        input.pointer.id = null;
        input.pinch = spread();
        return;
      }
      if (input.pointer.active || input.touches.size > 2) return;
      input.pointer.active = true;
      input.pointer.id = e.pointerId;
      input.pointer.x = e.clientX;
      input.pointer.y = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (input.touches.has(e.pointerId)) input.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (input.touches.size === 2 && input.pinch > 0) {
        const d = spread();
        if (d > 0) input.zoom *= d / input.pinch;
        input.pinch = d;
        return;
      }
      if (e.pointerId !== input.pointer.id) return;
      input.pointer.x = e.clientX;
      input.pointer.y = e.clientY;
    });
    const release = (e) => {
      input.touches.delete(e.pointerId);
      if (input.touches.size < 2) input.pinch = 0;
      if (e.pointerId !== input.pointer.id) return;
      input.pointer.active = false;
      input.pointer.id = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      input.keys.add(e.code);
      // Le caractère (e.key) est aussi transmis : utile pour les touches qui changent de place selon le clavier (M).
      if (input.onAction && !e.repeat && input.onAction(e.code, e.key)) e.preventDefault();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => input.keys.delete(e.code));
    // Sans ça, une touche relâchée hors de la fenêtre resterait « enfoncée ».
    window.addEventListener('blur', () => {
      input.keys.clear();
      input.pointer.active = false;
      input.pointer.id = null;
    });

    return input;
  }

  function pressed(input, dir) {
    return KEYS[dir].some((code) => input.keys.has(code));
  }

  // Calcule la direction de déplacement pour ce pas de simulation.
  function update(input, game, renderer) {
    let x = (pressed(input, 'right') ? 1 : 0) - (pressed(input, 'left') ? 1 : 0);
    let y = (pressed(input, 'down') ? 1 : 0) - (pressed(input, 'up') ? 1 : 0);

    if (x || y) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    } else if (input.pointer.active) {
      const target = Vide.Render.screenToWorld(renderer, input.pointer.x, input.pointer.y);
      const dx = target.x - game.state.player.x;
      const dy = target.y - game.state.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > DEAD_ZONE) {
        const strength = util.clamp(dist / SLOW_RADIUS, 0, 1);
        x = (dx / dist) * strength;
        y = (dy / dist) * strength;
      }
    }

    input.move.x = x;
    input.move.y = y;
    return input;
  }

  Vide.Input = { create, update };
})(globalThis.Vide);
