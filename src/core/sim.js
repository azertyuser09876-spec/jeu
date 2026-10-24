// Simulation : fait avancer le monde d'un pas de temps. Aucune dépendance au navigateur.
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // Entrée attendue par step() :
  //   move  direction souhaitée, de longueur 0 à 1
  //   pulse demande ponctuelle de pulsation (remise à false une fois traitée)
  function emptyInput() {
    return { move: { x: 0, y: 0 }, pulse: false };
  }

  function create(state) {
    const game = {
      state,
      stats: Vide.Stats.compute(state),
      field: Vide.Field.create(state.seed),
      velocity: { x: 0, y: 0 },
      time: 0,
      rate: 0,   // lumière par seconde, lissée sur quelques secondes
      glow: 0,   // éclat bref de la lumière après une récolte (0 à 1), purement visuel
      pulse: {
        cooldown: 0,  // secondes restantes avant la prochaine pulsation
        duration: 1,  // durée totale de la recharge en cours (pour l'affichage)
        wave: -1,     // rayon actuel de l'onde, -1 si aucune onde en cours
      },
      // Événements de ce qui vient de se passer ({ type, … }), lus puis vidés par l'interface.
      events: [],
      lit: state.territory.lit, // pour détecter l'allumage du foyer
    };
    Vide.Field.fill(game.field, state.player.x, state.player.y, game.stats);
    game.garden = Vide.Garden.create(state.seed);
    Vide.Garden.fill(game.garden, state, game.stats);
    Vide.Colony.create(game);
    return game;
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

  function gainLight(game, amount) {
    game.state.light += amount;
    game.state.totalLight += amount;
  }

  function pulseReady(game) {
    return game.pulse.cooldown <= 0;
  }

  // Déclenche une pulsation si elle est rechargée. Renvoie vrai si elle part.
  function pulse(game) {
    if (!pulseReady(game)) return false;
    game.pulse.cooldown = game.pulse.duration = game.stats.pulseCooldown;
    game.pulse.wave = 0;
    return true;
  }

  function emit(game, type, data) {
    game.events.push({ type, ...data });
    // Garde-fou si personne ne lit les événements (tests, robot d'équilibrage).
    if (game.events.length > 100) game.events.shift();
  }

  function updatePulse(game, dt) {
    const p = game.pulse;
    const { player } = game.state;
    const boost = Vide.Territory.isInside(game.state, player.x, player.y) ? CONFIG.territory.insidePulseBoost : 1;
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt * boost);
    if (p.wave < 0) return;
    // L'onde suit la lumière et attrape tout ce qu'elle a déjà traversé.
    p.wave = Math.min(p.wave + CONFIG.pulse.waveSpeed * dt, game.stats.pulseRadius);
    Vide.Field.catchWithin(game.field, player.x, player.y, p.wave);
    Vide.Field.catchList(game.garden.particles, player.x, player.y, p.wave);
    if (p.wave >= game.stats.pulseRadius) p.wave = -1;
  }

  function step(game, dt, input) {
    const { state } = game;
    game.stats = Vide.Stats.compute(state);
    game.time += dt;
    state.stats.playTime += dt;

    if (input.pulse) {
      input.pulse = false;
      pulse(game);
    }

    movePlayer(game, dt, input.move);
    updatePulse(game, dt);

    const harvest = Vide.Field.update(game.field, state.player, game.stats, dt);
    const picked = Vide.Garden.update(game.garden, state, game.stats, dt);
    harvest.value += picked.value;
    harvest.count += picked.count;
    let gained = harvest.value * game.stats.value;
    if (harvest.count) {
      gainLight(game, gained);
      state.stats.collected += harvest.count;
      game.glow = Math.min(1, game.glow + 0.25 * harvest.count);
    }

    if (state.territory.lit && !game.lit) {
      game.lit = true;
      emit(game, 'foyer');
    }
    const radiated = Vide.Territory.advance(state, game.stats, dt);
    if (radiated > 0) {
      gainLight(game, radiated);
      gained += radiated;
    }
    Vide.Colony.sync(game);
    const brought = Vide.Colony.update(game, dt);
    if (brought > 0) {
      gainLight(game, brought);
      gained += brought;
    }
    game.glow *= 1 - util.damp(4, dt);
    game.rate += (gained / dt - game.rate) * util.damp(1 / 3, dt);
  }

  Vide.Sim = { create, step, emptyInput, gainLight, emit, pulse, pulseReady };
})(globalThis.Vide);
