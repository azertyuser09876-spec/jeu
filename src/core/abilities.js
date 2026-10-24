// Capacités de la lumière, achetées dans l'onglet lumière (améliorations à trois niveaux, voir upgrades.js) :
//   Ruée    un élan bref et fulgurant, pendant lequel rien ne l'atteint.
//   Fanal   une lumière posée (state.beacon) : elle récolte seule la lumière de sa zone, au rythme où le vide
//           s'y remplit (même pendant l'absence), et la garde ; on reprend sa réserve en repassant près d'elle,
//           ou en le reposant ailleurs.
//   Retour  après une courte concentration, la lumière se rassemble au cœur du village le plus proche.
// Chaque niveau au-delà du premier raccourcit la recharge d'un quart.
(function (Vide) {
  'use strict';
  const { CONFIG, Field } = Vide;

  function cooldown(base, level) {
    return base * Math.pow(0.75, Math.max(0, level - 1));
  }

  function create(game) {
    game.abilities = {
      dash: { cd: 0, t: 0, dx: 1, dy: 0 },
      beacon: { cd: 0 },
      recall: { cd: 0, channel: -1 },
    };
  }

  function ready(game, id) {
    return game.stats[id] > 0 && game.abilities[id].cd <= 0;
  }

  // Ruée : dans la direction où va la lumière (ou la dernière connue).
  function dash(game) {
    if (!ready(game, 'dash')) return false;
    const A = CONFIG.abilities;
    const a = game.abilities.dash;
    const v = game.velocity;
    const d = Math.hypot(v.x, v.y);
    if (d > 5) {
      a.dx = v.x / d;
      a.dy = v.y / d;
    }
    a.t = A.dashTime;
    a.cd = cooldown(A.dashCooldown, game.stats.dash);
    game.vitality.invulnerable = Math.max(game.vitality.invulnerable, A.dashTime + 0.15);
    Vide.Sim.emit(game, 'dash', {});
    return true;
  }

  // Vitesse imposée pendant une ruée, ou null.
  function dashVelocity(game) {
    const a = game.abilities.dash;
    if (a.t <= 0) return null;
    const speed = game.stats.speed * CONFIG.abilities.dashSpeed;
    return { x: a.dx * speed, y: a.dy * speed };
  }

  function placeBeacon(game) {
    if (!ready(game, 'beacon')) return false;
    const { state } = game;
    // L'ancien fanal rend ce qu'il gardait.
    if (state.beacon && state.beacon.light > 0) Vide.Sim.gainLight(game, state.beacon.light);
    state.beacon = { x: state.player.x, y: state.player.y, light: 0 };
    game.abilities.beacon.cd = cooldown(CONFIG.abilities.beaconCooldown, game.stats.beacon);
    Vide.Sim.emit(game, 'beacon', {});
    return true;
  }

  function recall(game) {
    const a = game.abilities.recall;
    if (!ready(game, 'recall') || !game.state.villages.length || a.channel >= 0) return false;
    a.channel = CONFIG.abilities.recallChannel;
    Vide.Sim.emit(game, 'recallStart', {});
    return true;
  }

  function beaconRadius(stats) {
    return CONFIG.abilities.beaconRadius * (1 + 0.25 * Math.max(0, stats.beacon - 1));
  }

  // Lumière par seconde que récolte le fanal : ce que le vide fait naître dans son rayon (densité de la zone,
  // améliorations), à la valeur où le joueur l'aurait récoltée.
  function beaconRate(state, stats) {
    const b = state.beacon;
    if (!b || !(stats.beacon > 0)) return 0;
    const f = CONFIG.field;
    const zone = Vide.Zones.at(state.seed, b.x, b.y).zone;
    const r = beaconRadius(stats);
    const count = f.density * Math.PI * r * r * stats.density * zone.density;
    const value = 1 + f.rareChance * zone.rare * (f.rareValue - 1);
    return (count / f.refillTime) * value * stats.value * stats.lightMult;
  }

  // Le fanal garde ce qu'il récolte, jusqu'à ce qu'on repasse près de lui.
  function updateBeacon(game, dt) {
    const b = game.state.beacon;
    if (!b) return;
    const A = CONFIG.abilities;
    b.light += beaconRate(game.state, game.stats) * dt;
    // La lumière revient en repassant près de lui.
    const { player } = game.state;
    if (b.light > 0 && Math.hypot(player.x - b.x, player.y - b.y) <= A.beaconReach) {
      Vide.Sim.gainLight(game, b.light);
      Vide.Sim.emit(game, 'beaconCollected', { light: b.light });
      b.light = 0;
    }
  }

  // Avance les capacités d'un pas : demandes du joueur, recharges, ruée, fanal, concentration du retour.
  // Renvoie la lumière gagnée en reprenant le fanal (pour le débit affiché), 0 sinon.
  function update(game, dt, input) {
    const ab = game.abilities;
    if (input.dash) dash(game);
    if (input.beacon) placeBeacon(game);
    if (input.recall) recall(game);
    input.dash = input.beacon = input.recall = false;
    for (const id of ['dash', 'beacon', 'recall']) ab[id].cd = Math.max(0, ab[id].cd - dt);
    ab.dash.t = Math.max(0, ab.dash.t - dt);
    updateBeacon(game, dt);

    const r = ab.recall;
    if (r.channel < 0) return;
    r.channel -= dt;
    if (r.channel > 0) return;
    r.channel = -1;
    const { state } = game;
    const from = { x: state.player.x, y: state.player.y };
    const home = Vide.Villages.nearest(state, from.x, from.y);
    if (!home) return;
    state.player.x = home.x;
    state.player.y = home.y;
    game.velocity.x = game.velocity.y = 0;
    game.field.particles.length = 0;
    Field.fill(game.field, home.x, home.y, game.stats);
    r.cd = cooldown(CONFIG.abilities.recallCooldown, game.stats.recall);
    Vide.Sim.emit(game, 'recall', { from, to: { x: home.x, y: home.y }, village: home.type });
  }

  Vide.Abilities = { cooldown, create, ready, dash, dashVelocity, placeBeacon, recall, beaconRadius, beaconRate, update };
})(globalThis.Vide);
