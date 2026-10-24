// Absence : quand le joueur revient (page rouverte ou onglet réaffiché), le monde a continué sans lui.
// La durée prise en compte est plafonnée par la caractéristique offlineCap (amélioration Mémoire).
(function (Vide) {
  'use strict';
  const { Territory } = Vide;

  // Applique `seconds` d'absence à l'état. Renvoie un rapport pour l'écran « pendant ton absence ».
  function apply(state, seconds) {
    const stats = Vide.Stats.compute(state);
    const away = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const applied = Math.min(away, stats.offlineCap);
    const report = {
      seconds: away,
      applied,
      capped: away > stats.offlineCap,
      light: 0,
      radiated: 0,
      brought: 0,
      built: [],
      radiusBefore: Territory.radius(state),
      radiusAfter: Territory.radius(state),
    };
    if (applied <= 0) return report;

    const radiated = Territory.advance(state, stats, applied) * stats.lightMult;
    report.built = Vide.Structures.advanceOffline(state, stats, applied);
    // Les êtres continuent leur travail au rythme mesuré avant le départ.
    const brought = Vide.Colony.total(state) > 0 ? state.colonyRate * applied * stats.lightMult : 0;
    const light = radiated + brought;
    state.light += light;
    state.totalLight += light;
    report.light = light;
    report.radiated = radiated;
    report.brought = brought;
    report.radiusAfter = Territory.radius(state);
    return report;
  }

  // Inutile de déranger le joueur pour une absence courte ou sans effet.
  function worthShowing(report) {
    return report.seconds >= 60 && (report.light > 0 || report.built.length > 0);
  }

  Vide.Offline = { apply, worthShowing };
})(globalThis.Vide);
