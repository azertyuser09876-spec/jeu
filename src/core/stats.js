// Caractéristiques effectives du joueur : valeurs de base, puis effets des améliorations.
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  function base() {
    return {
      speed: CONFIG.player.speed,
      reach: CONFIG.attraction.radius,
      density: 1,   // multiplicateur de la densité du champ
      value: 1,     // multiplicateur de la lumière gagnée par particule
      pulseRadius: CONFIG.pulse.radius,
      pulseCooldown: CONFIG.pulse.cooldown,
    };
  }

  function compute(state) {
    const stats = base();
    for (const up of Vide.UPGRADES) {
      const level = state.upgrades[up.id] || 0;
      for (const key in up.effects) stats[key] = up.effects[key](level);
    }
    return stats;
  }

  Vide.Stats = { base, compute };
})(globalThis.Vide);
