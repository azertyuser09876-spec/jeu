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
      territoryGrowth: CONFIG.territory.growth,
      territoryYield: CONFIG.territory.yield,
      offlineCap: CONFIG.territory.offlineCap,
      gardenDensity: 1,     // multiplicateur de la lumière qui naît dans le territoire
      beingCap: CONFIG.colony.cap,
      beingSpeed: 1,        // multiplicateur de vitesse des êtres
      beingCapacity: 3,     // particules portées par une lueur avant de rentrer
      beingValue: 1,        // multiplicateur de la lumière rapportée par les êtres
      beingSense: 320,      // distance à laquelle une lueur repère la lumière
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
