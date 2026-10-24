// Absence : quand le joueur revient (page rouverte ou onglet réaffiché), le monde a continué sans lui.
// La durée prise en compte est plafonnée par la caractéristique offlineCap (amélioration Mémoire).
(function (Vide) {
  'use strict';
  const { Territory, Villages } = Vide;

  // Applique `seconds` d'absence à l'état. Renvoie un rapport pour l'écran « pendant ton absence ».
  function apply(state, seconds) {
    const stats = Vide.Stats.compute(state);
    const away = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    const applied = Math.min(away, stats.offlineCap);
    // Le plus grand village sert de repère (« ton territoire s'est étendu »).
    const largest = Villages.main(state);
    const report = {
      seconds: away,
      applied,
      capped: away > stats.offlineCap,
      light: 0,
      radiated: 0,
      brought: 0,
      built: [],
      walls: 0,      // enceintes achevées
      kept: 0,       // lumière mise de côté par les intendants
      steward: [],   // ce qu'ils en ont fait
      villages: state.villages.length,
      radiusBefore: Territory.radius(largest),
      radiusAfter: Territory.radius(largest),
    };
    if (applied <= 0) return report;

    // Les nids vieillissent (mais ne lancent pas de raid : pas d'ombres pendant l'absence).
    Vide.Nests.offline(state, applied);

    // Le fanal a récolté pendant ce temps.
    if (state.beacon) {
      report.beacon = Vide.Abilities.beaconRate(state, stats) * applied;
      state.beacon.light += report.beacon;
    }

    // Les ressources se produisent et circulent le long des routes.
    Vide.Trade.offline(state, applied);

    for (const v of state.villages) {
      const local = Villages.local(state, v, stats);
      const funds = v.funds;
      report.radiated += Vide.Steward.share(state, v, Territory.advance(v, local, applied, state.nests) * stats.lightMult);
      Territory.whiten(v, local, applied);
      // Les bâtisseurs finissent les chantiers, puis relèvent les brèches et avancent l'enceinte.
      let reserved = 0;
      for (const b of Vide.Structures.sites(v)) reserved += Vide.Structures.def(b.type).work - b.work;
      report.built.push(...Vide.Structures.advanceOffline(v, local, applied));
      report.walls += Vide.Walls.advanceOffline(v, local, applied, reserved);
      // Les êtres continuent leur travail au rythme mesuré avant le départ.
      if (Object.keys(v.beings).length) report.brought += Vide.Steward.share(state, v, v.rate * applied * stats.lightMult);
      // L'intendant a mis de côté sa part, et l'a dépensée au fil du temps.
      report.kept += v.funds - funds;
      report.steward.push(...Vide.Steward.catchUp(state, v));
    }
    report.roads = Vide.Roads.advance(state, (v) => Villages.local(state, v, stats), applied).length;
    report.cities = Vide.Cities.fuse(state).length;
    report.expeditions = Vide.Expeditions.offline(state, applied);
    const light = report.radiated + report.brought;
    state.light += light;
    state.totalLight += light;
    report.light = light;
    report.radiusAfter = Territory.radius(largest);
    return report;
  }

  // Inutile de déranger le joueur pour une absence courte ou sans effet.
  function worthShowing(report) {
    return report.seconds >= 60 && (report.light > 0 || report.built.length > 0);
  }

  Vide.Offline = { apply, worthShowing };
})(globalThis.Vide);
