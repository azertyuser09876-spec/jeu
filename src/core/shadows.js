// Les ombres : attirées par la lumière, elles viennent par marées vers les villages,
// et errent dans le vide lointain. Rien de tout cela n'est sauvegardé (sauf le nombre de marées passées).
(function (Vide) {
  'use strict';
  const { CONFIG, util, Territory, Structures, Colony, Villages } = Vide;

  // Catalogue des ombres.
  //   prefers   cible préférée : 'any' (la plus proche), 'beings' (les êtres), 'structures' (bâtiments, cœurs)
  //   cost      poids dans le « budget » d'une marée ; fromTide : première marée où elle apparaît
  Vide.SHADOW_KINDS = [
    { id: 'errante', name: 'Errante', hp: 20, speed: 45, damage: 8, cooldown: 1, radius: 12,
      prefers: 'any', echoes: 1, cost: 1, fromTide: 0 },
    { id: 'rodeuse', name: 'Rôdeuse', hp: 12, speed: 95, damage: 5, cooldown: 0.6, radius: 9,
      prefers: 'beings', echoes: 1, cost: 1, fromTide: 2 },
    { id: 'massive', name: 'Massive', hp: 110, speed: 26, damage: 22, cooldown: 1.8, radius: 22,
      prefers: 'structures', echoes: 5, cost: 4, fromTide: 4 },
  ];

  function kind(id) {
    const k = Vide.SHADOW_KINDS.find((s) => s.id === id);
    if (!k) throw new Error(`Ombre inconnue : ${id}`);
    return k;
  }

  function create(game) {
    const rng = util.rng(game.state.seed ^ 0x7f4a7c15);
    const c = CONFIG.shadows;
    game.shadows = {
      list: [],
      nextId: 1,
      rng,
      tideTimer: c.tideInterval * (0.6 + rng() * 0.4), // la première marée arrive un peu plus vite
      roamTimer: 4 + rng() * 4, // en zone dangereuse, la première ombre ne tarde pas
    };
    return game.shadows;
  }

  function spawn(game, kindId, x, y, origin) {
    const k = kind(kindId);
    const s = {
      id: game.shadows.nextId++,
      kind: kindId,
      x, y,
      vx: 0, vy: 0,
      hp: k.hp,
      maxHp: k.hp,
      cd: game.shadows.rng() * k.cooldown,
      target: null,
      retarget: 0,
      origin,             // 'tide' (marée) ou 'roam' (errance)
      home: null,         // marée : le village visé (elle y marche tant qu'elle n'a pas de proie)
      phase: game.shadows.rng() * Math.PI * 2,
      hitFlash: 0,
      lastWave: -1,       // identifiant de la dernière onde de pulsation qui l'a touchée
      age: 0,
    };
    game.shadows.list.push(s);
    return s;
  }

  // Tirage pondéré d'une sorte d'ombre : { errante: 2, rodeuse: 1 } → 'errante' deux fois sur trois.
  function pickKind(weights, roll) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let acc = 0;
    for (const [id, w] of entries) {
      acc += w / total;
      if (roll < acc) return id;
    }
    return entries[entries.length - 1][0];
  }

  // Taille d'une marée : grandit avec le nombre de marées passées et la taille du territoire visé.
  function tideBudget(state, village) {
    const c = CONFIG.shadows;
    return c.tideBase + c.tidePerWave * state.tides + Territory.radius(village) * c.tidePerRadius;
  }

  // Villages assez grands pour attirer les marées.
  function tideTargets(state) {
    return state.villages.filter((v) => Territory.radius(v) >= CONFIG.shadows.firstTideRadius);
  }

  // Lance une marée vers un village (tiré au sort, d'autant plus souvent qu'il est vaste),
  // depuis une direction au hasard, au-delà du bord de son territoire.
  function startTide(game, village) {
    const { state } = game;
    const c = CONFIG.shadows;
    const r = game.shadows.rng;
    if (!village) {
      const targets = tideTargets(state);
      if (!targets.length) return 0;
      let roll = r() * targets.reduce((sum, v) => sum + v.area, 0);
      village = targets.find((v) => (roll -= v.area) < 0) || targets[targets.length - 1];
    }
    const angle = r() * Math.PI * 2;
    const dist = Territory.radius(village) + c.tideDistance;
    const cx = village.x + Math.cos(angle) * dist, cy = village.y + Math.sin(angle) * dist;
    const kinds = Vide.SHADOW_KINDS.filter((k) => state.tides >= k.fromTide);
    let budget = tideBudget(state, village);
    let count = 0;
    while (budget >= 1 && game.shadows.list.length < c.max) {
      const affordable = kinds.filter((k) => k.cost <= budget);
      const k = affordable[Math.floor(r() * affordable.length)];
      budget -= k.cost;
      const s = spawn(game, k.id, cx + (r() - 0.5) * 2 * c.tideSpread, cy + (r() - 0.5) * 2 * c.tideSpread, 'tide');
      s.home = village;
      count++;
    }
    state.tides++;
    Vide.Sim.emit(game, 'tide', { angle, x: cx, y: cy, village: village.type, count, first: state.tides === 1 });
    return count;
  }

  // --- Cibles ---

  function targetPos(t) {
    return t.ref;
  }

  function targetValid(game, t) {
    if (!t) return false;
    if (t.type === 'player') return !game.vitality.invulnerable;
    if (t.type === 'being') return Colony.isActive(t.ref) && game.colony.beings.includes(t.ref);
    if (t.type === 'building') return Structures.isWorking(t.ref) && game.state.villages.includes(t.village);
    if (t.type === 'heart') return game.state.villages.includes(t.ref);
    if (t.type === 'expedition') return game.state.expeditions.includes(t.ref);
    return false;
  }

  // Choisit une proie selon la nature de l'ombre, parmi ce qui est à portée de sens.
  function chooseTarget(game, s) {
    const k = kind(s.kind);
    const sense2 = CONFIG.shadows.sense ** 2;
    const candidates = [];
    const consider = (type, ref, x, y, weight, village) => {
      const d2 = (x - s.x) ** 2 + (y - s.y) ** 2;
      if (d2 <= sense2) candidates.push({ type, ref, village, score: d2 * weight });
    };
    const pref = (group) => (k.prefers === 'any' || k.prefers === group ? 1 : 6);

    const { player } = game.state;
    if (!game.vitality.invulnerable) consider('player', player, player.x, player.y, pref('player'));
    for (const b of game.colony.beings) if (Colony.isActive(b)) consider('being', b, b.x, b.y, pref('beings'));
    for (const v of game.state.villages) {
      for (const b of v.buildings) if (Structures.isWorking(b)) consider('building', b, b.x, b.y, pref('structures'), v);
      consider('heart', v, v.x, v.y, pref('structures'));
    }
    for (const e of game.state.expeditions) consider('expedition', e, e.x, e.y, pref('beings'));

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0] || null;
  }

  function reachOf(t) {
    if (t.type === 'building') return Structures.def(t.ref.type).size;
    if (t.type === 'heart') return 24;
    return 8;
  }

  // --- Mise à jour ---

  function update(game, dt) {
    const sh = game.shadows;
    const { state } = game;
    const c = CONFIG.shadows;

    // Marées : seulement une fois un territoire assez grand pour attirer les ombres.
    if (tideTargets(state).length) {
      sh.tideTimer -= dt;
      if (sh.tideTimer <= 0) {
        startTide(game);
        sh.tideTimer = c.tideInterval + (sh.rng() - 0.5) * 2 * c.tideJitter;
      }
    }

    // Errance : loin des villages (ou de l'origine, tant qu'il n'y en a aucun), la zone traversée fait surgir
    // ses ombres près du joueur.
    const zone = game.region ? game.region.zone : null;
    const far = state.villages.length
      ? Territory.distanceToEdge(state, state.player.x, state.player.y)
      : Math.hypot(state.player.x, state.player.y);
    if (zone && zone.shadows > 0 && far > c.roamBeyond) {
      sh.roamTimer -= dt * zone.shadows;
      const roaming = sh.list.filter((s) => s.origin === 'roam').length;
      if (sh.roamTimer <= 0 && roaming < c.roamMax * Math.ceil(zone.shadows)) {
        const a = sh.rng() * Math.PI * 2;
        const d = 500 + sh.rng() * 200;
        const s = spawn(game, pickKind(zone.kinds, sh.rng()), state.player.x + Math.cos(a) * d,
          state.player.y + Math.sin(a) * d, 'roam');
        s.echoMult = zone.echoes;
        sh.roamTimer = (1 / c.roamRate) * (0.6 + sh.rng() * 0.8);
      }
    }

    // Les expéditions loin de tout croisent aussi les ombres des zones qu'elles traversent.
    for (const e of state.expeditions) {
      const z = Vide.Zones.at(state.seed, e.x, e.y).zone;
      if (!z.shadows || Territory.distanceToEdge(state, e.x, e.y) < c.roamBeyond) continue;
      if (sh.rng() > c.roamRate * z.shadows * dt) continue;
      const a = sh.rng() * Math.PI * 2;
      const s = spawn(game, pickKind(z.kinds, sh.rng()), e.x + Math.cos(a) * 320, e.y + Math.sin(a) * 320, 'roam');
      s.echoMult = z.echoes;
      s.near = e; // elle rôde autour de l'expédition, pas du joueur
    }

    for (const s of sh.list) {
      const k = kind(s.kind);
      s.age += dt;
      // Dans un territoire, la lumière ronge lentement les ombres : une marée finit toujours par s'éteindre.
      // Dans le blanc, bien plus vite.
      const over = Villages.at(state, s.x, s.y);
      s.burning = Boolean(over);
      if (over) {
        const white = Territory.whiteOf(over, Territory.cellOf(s.x), Territory.cellOf(s.y));
        const burn = 1 + (CONFIG.territory.whiteBurn - 1) * Math.max(0, white);
        s.hp -= c.territoryBurn * Villages.statsOf(game, over).burn * burn * dt;
      }
      s.cd = Math.max(0, s.cd - dt);
      s.hitFlash = Math.max(0, s.hitFlash - dt * 4);
      s.retarget -= dt;
      if (s.retarget <= 0 || !targetValid(game, s.target)) {
        s.target = chooseTarget(game, s);
        s.retarget = 0.5;
      }

      let tx, ty;
      if (s.target) {
        const p = targetPos(s.target);
        tx = p.x; ty = p.y;
      } else if (s.near && state.expeditions.includes(s.near)) {
        tx = s.near.x; ty = s.near.y; // elle suit l'expédition qu'elle a repérée
      } else if (s.home && state.villages.includes(s.home)) {
        tx = s.home.x; ty = s.home.y; // une marée sans proie en vue avance vers le cœur du village visé
      } else {
        tx = state.player.x; ty = state.player.y;
      }
      const dx = tx - s.x, dy = ty - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = s.target ? k.radius + reachOf(s.target) : 0;
      // Mouvement lourd et ondulant, qui s'arrête au contact (et ralentit le long d'un rempart).
      const speed = d > reach ? k.speed * Structures.wardAt(state, s.x, s.y) : 0;
      const kk = util.damp(3, dt);
      const wobble = Math.sin(s.age * 2 + s.phase) * 0.35;
      const ux = dx / d, uy = dy / d;
      s.vx += ((ux - uy * wobble) * speed - s.vx) * kk;
      s.vy += ((uy + ux * wobble) * speed - s.vy) * kk;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.target && d <= reach + 4 && s.cd <= 0) {
        s.cd = k.cooldown;
        Vide.Combat.strike(game, s, s.target, k.damage);
      }
    }

    // Disparition des ombres vaincues (avec récompense) ou égarées trop loin de tout.
    for (let i = sh.list.length - 1; i >= 0; i--) {
      const s = sh.list[i];
      if (s.hp <= 0) {
        const k = kind(s.kind);
        const echoes = k.echoes * game.stats.echoGain * (s.echoMult || 1);
        state.echoes += echoes;
        state.stats.shadows++;
        Vide.Sim.emit(game, 'shadowDown', { kind: s.kind, x: s.x, y: s.y, echoes, first: state.stats.shadows === 1 });
        s.gone = true;
        sh.list.splice(i, 1);
        continue;
      }
      let fromPlayer = Math.hypot(s.x - state.player.x, s.y - state.player.y);
      if (s.near && state.expeditions.includes(s.near)) fromPlayer = Math.min(fromPlayer, Math.hypot(s.x - s.near.x, s.y - s.near.y));
      if (fromPlayer > c.despawn && (s.origin === 'roam' || !(Territory.distanceToEdge(state, s.x, s.y) <= c.despawn))) {
        s.gone = true;
        sh.list.splice(i, 1);
      }
    }
  }

  // Blesse une ombre ; renvoie vrai si elle est vaincue.
  function damage(s, amount) {
    if (s.hp <= 0) return false;
    s.hp -= amount;
    s.hitFlash = 1;
    return s.hp <= 0;
  }

  // Ombre vivante la plus proche de (x, y) dans un rayon, éventuellement filtrée.
  function nearest(game, x, y, maxDist, filter) {
    let best = null;
    let bestD2 = maxDist * maxDist;
    for (const s of game.shadows.list) {
      if (s.hp <= 0 || (filter && !filter(s))) continue;
      const d2 = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = s;
      }
    }
    return best;
  }

  Vide.Shadows = { kind, create, spawn, pickKind, tideBudget, tideTargets, startTide, update, damage, nearest };
})(globalThis.Vide);
