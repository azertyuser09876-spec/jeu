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
      buildRate: 1,         // travail fourni par un bâtisseur par seconde
      builderCap: 2,        // nombre maximal de bâtisseurs (ils ne comptent pas dans la population)
      beingHp: 1,           // multiplicateur des points de vie des êtres
      armyDamage: 1,        // multiplicateur des dégâts et soins de l'armée et des tours
      pulseDamage: CONFIG.combat.pulseDamage,
      vitality: CONFIG.combat.vitality,
      echoGain: 1,          // multiplicateur des échos laissés par les ombres
      lightMult: 1,         // multiplicateur de toute la lumière gagnée (souvenirs)
      startRadius: CONFIG.territory.startRadius, // rayon du territoire au départ (souvenirs)
      startLueurs: 0,       // lueurs présentes dès le départ d'une renaissance (souvenirs)
      dash: 0,              // niveau des capacités (0 : pas encore acquise)
      beacon: 0,
      recall: 0,
    };
  }

  function compute(state) {
    const stats = base();
    for (const up of Vide.UPGRADES) {
      const level = (up.legacy ? state.legacy : state.upgrades)[up.id] || 0;
      for (const key in up.effects) stats[key] = up.effects[key](level);
    }
    // Modificateurs qui se cumulent aux effets (souvenirs…).
    for (const up of Vide.UPGRADES) {
      if (!up.modify) continue;
      const level = (up.legacy ? state.legacy : state.upgrades)[up.id] || 0;
      if (level > 0) up.modify(stats, level);
    }
    // Les bâtiments à portée globale (Archive, Fonderie, Lunette…). Les autres, et le type de chaque village,
    // n'agissent que sur leur village : voir Villages.local.
    if (Vide.Structures) Vide.Structures.modifyGlobal(state, stats);
    // Puis les colosses apaisés.
    if (Vide.Colossus) Vide.Colossus.modify(state, stats);
    return stats;
  }

  Vide.Stats = { base, compute };
})(globalThis.Vide);
