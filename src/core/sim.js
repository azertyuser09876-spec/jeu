// Simulation : fait avancer le monde d'un pas de temps. Aucune dépendance au navigateur.
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // Entrée attendue par step() :
  //   move  direction souhaitée, de longueur 0 à 1
  //   pulse demande ponctuelle de pulsation (remise à false une fois traitée)
  function emptyInput() {
    return { move: { x: 0, y: 0 }, pulse: false, dash: false, beacon: false, recall: false };
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
        id: 0,        // numéro de l'onde (une ombre n'est blessée qu'une fois par onde)
      },
      // Événements de ce qui vient de se passer ({ type, … }), lus puis vidés par l'interface.
      events: [],
      villageCount: state.villages.length, // pour détecter la fondation d'un village
      villageStats: new Map(),             // caractéristiques de chaque village (recalculées à chaque pas)
      expeditionsFighting: new Set(),      // expéditions arrêtées par un combat (affichage)
      region: null,             // région du vide où se trouve la lumière (voir zones.js)
      zoneShown: null,          // dernière zone annoncée à l'écran
      loreCheck: 0,             // délai avant de vérifier les fragments du récit
      renaissances: state.renaissances, // pour détecter une renaissance (achetée dans la boutique)
    };
    updateRegion(game, true);
    Vide.Villages.refresh(game);
    Vide.Field.fill(game.field, state.player.x, state.player.y, game.stats);
    game.garden = Vide.Garden.create(state.seed);
    Vide.Garden.fill(game);
    Vide.Colony.create(game);
    game.structureHp = new Map(); // solidité des bâtiments abîmés (voir structures.js)
    Vide.Shadows.create(game);
    Vide.Combat.create(game);
    Vide.Colossus.create(game);
    Vide.Trade.create(game);
    Vide.Abilities.create(game);
    Vide.Nests.create(game);
    // Une partie déjà avancée (venue d'une version sans récit) remplit son journal d'un coup,
    // sans faire défiler chaque fragment.
    const known = Vide.Lore.check(state);
    if (known.length > 2) emit(game, 'loreBatch', { count: known.length });
    else for (const id of known) emit(game, 'lore', { id });
    return game;
  }

  // Effets de la zone pour le champ de particules.
  function zoneMods(game) {
    const { zone, current } = game.region;
    // Dans l'obscurité d'un nid, le vide fait naître bien moins de lumière.
    const { player } = game.state;
    const dark = game.state.nests.length && Vide.Nests.darkAt(game.state, player.x, player.y);
    return { density: zone.density * (dark ? CONFIG.nests.darkField : 1), rare: zone.rare, current };
  }

  // Suit la région traversée : visite, découverte, annonce (avec un peu d'hystérésis aux frontières).
  function updateRegion(game, silent) {
    const { state } = game;
    const region = Vide.Zones.at(state.seed, state.player.x, state.player.y);
    const changed = !game.region || game.region.key !== region.key;
    game.region = region;
    if (!changed) return;
    const discovered = Vide.Zones.visit(state, region);
    if (silent) {
      game.zoneShown = region.zone.id;
      return;
    }
    if (discovered) emit(game, 'zoneDiscovered', { zone: region.zone.id });
  }

  function announceZone(game) {
    const { region } = game;
    if (region.zone.id !== game.zoneShown && region.edge > 120) {
      game.zoneShown = region.zone.id;
      emit(game, 'zoneEnter', { zone: region.zone.id });
    }
  }

  function movePlayer(game, dt, move) {
    const { player } = game.state;
    const v = game.velocity;
    // Une toile de colosse ralentit fortement la lumière ; une route la fait filer.
    let speed = game.stats.speed * (game.webs ? Vide.Colossus.slowAt(game, player.x, player.y) : 1);
    if (game.state.roads.length && Vide.Roads.onRoad(game.state, player.x, player.y)) speed *= CONFIG.roads.speedBonus;
    const k = util.damp(CONFIG.player.acceleration, dt);
    v.x += (move.x * speed - v.x) * k;
    v.y += (move.y * speed - v.y) * k;
    // Une ruée impose sa vitesse.
    const dash = Vide.Abilities.dashVelocity(game);
    if (dash) {
      v.x = dash.x;
      v.y = dash.y;
    }
    // Le courant de la zone emporte la lumière.
    const current = game.region.current;
    player.x += (v.x + current.x) * dt;
    player.y += (v.y + current.y) * dt;
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
    game.pulse.id++;
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
    const home = Vide.Villages.at(game.state, player.x, player.y);
    const boost = home ? CONFIG.territory.insidePulseBoost * Vide.Villages.statsOf(game, home).pulseBoost : 1;
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt * boost);
    if (p.wave < 0) return;
    // L'onde suit la lumière et attrape tout ce qu'elle a déjà traversé.
    p.wave = Math.min(p.wave + CONFIG.pulse.waveSpeed * dt, game.stats.pulseRadius);
    Vide.Field.catchWithin(game.field, player.x, player.y, p.wave);
    Vide.Field.catchList(game.garden.particles, player.x, player.y, p.wave);
    Vide.Combat.pulseHit(game, player.x, player.y, p.wave);
    if (p.wave >= game.stats.pulseRadius) p.wave = -1;
  }

  function step(game, dt, input) {
    const { state } = game;
    if (state.renaissances !== game.renaissances) {
      game.renaissances = state.renaissances;
      Vide.Renaissance.resetRuntime(game);
      emit(game, 'renaissance', { count: state.renaissances, memories: state.memories });
    }
    game.stats = Vide.Stats.compute(state);
    Vide.Villages.refresh(game);
    game.time += dt;
    state.stats.playTime += dt;

    if (input.pulse) {
      input.pulse = false;
      pulse(game);
    }

    Vide.Abilities.update(game, dt, input);
    movePlayer(game, dt, input.move);
    updateRegion(game, false);
    announceZone(game);
    updatePulse(game, dt);

    const harvest = Vide.Field.update(game.field, state.player, game.stats, dt, zoneMods(game));
    const picked = Vide.Garden.update(game, dt);
    harvest.value += picked.value;
    harvest.count += picked.count;
    // Toute la lumière gagnée est multipliée par l'Éclat ancien (souvenirs).
    const mult = game.stats.lightMult;
    let gained = harvest.value * game.stats.value * mult;
    if (harvest.count) {
      gainLight(game, gained);
      state.stats.collected += harvest.count;
      game.glow = Math.min(1, game.glow + 0.25 * harvest.count);
    }

    for (let k = game.villageCount; k < state.villages.length; k++) {
      const v = state.villages[k];
      emit(game, 'village', { village: v.type, x: v.x, y: v.y, first: k === 0 });
    }
    game.villageCount = state.villages.length;
    // Ce que produisent les villages : leur intendant en garde sa part, le reste revient au joueur.
    let radiated = 0;
    for (const v of state.villages) {
      const local = Vide.Villages.statsOf(game, v);
      radiated += Vide.Steward.share(state, v, Vide.Territory.advance(v, local, dt) * mult);
      Vide.Territory.whiten(v, local, dt);
    }
    if (radiated > 0) {
      gainLight(game, radiated);
      gained += radiated;
    }
    Vide.Colony.sync(game);
    Vide.Colony.update(game, dt);
    let brought = 0;
    for (const [v, g] of game.colony.gains) brought += Vide.Steward.share(state, v, g * mult);
    if (brought > 0) {
      gainLight(game, brought);
      gained += brought;
    }
    Vide.Steward.update(game, dt);
    Vide.Trade.update(game, dt);
    Vide.Cities.update(game, dt);
    Vide.Expeditions.update(game, dt);
    Vide.Nests.update(game, dt);
    for (const r of Vide.Roads.advance(state, (v) => Vide.Villages.statsOf(game, v), dt)) {
      const [a, b] = Vide.Roads.ends(state, r);
      emit(game, 'road', { a: a.type, b: b.type, first: state.roads.filter((x) => Vide.Roads.isDone(state, x)).length === 1 });
    }
    Vide.Shadows.update(game, dt);
    Vide.Colossus.update(game, dt);
    Vide.Combat.update(game, dt);

    // Récit : vérifié une fois par seconde, c'est bien assez.
    game.loreCheck -= dt;
    if (game.loreCheck <= 0) {
      game.loreCheck = 1;
      for (const id of Vide.Lore.check(state)) emit(game, 'lore', { id });
    }
    game.glow *= 1 - util.damp(4, dt);
    game.rate += (gained / dt - game.rate) * util.damp(1 / 3, dt);
  }

  Vide.Sim = { create, step, emptyInput, gainLight, emit, pulse, pulseReady };
})(globalThis.Vide);
