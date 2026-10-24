// Les ombres : attirées par la lumière, elles viennent par marées vers le territoire,
// et errent dans le vide lointain. Rien de tout cela n'est sauvegardé (sauf le nombre de marées passées).
(function (Vide) {
  'use strict';
  const { CONFIG, util, Territory, Structures, Colony } = Vide;

  // Catalogue des ombres.
  //   prefers   cible préférée : 'any' (la plus proche), 'beings' (les êtres), 'structures' (bâtiments, foyer)
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

  // Taille d'une marée : grandit avec le nombre de marées passées et la taille du territoire.
  function tideBudget(state) {
    const c = CONFIG.shadows;
    return c.tideBase + c.tidePerWave * state.tides + Territory.radius(state) * c.tidePerRadius;
  }

  // Lance une marée depuis une direction au hasard, au-delà du bord du territoire.
  function startTide(game) {
    const { state } = game;
    const c = CONFIG.shadows;
    const r = game.shadows.rng;
    const angle = r() * Math.PI * 2;
    const dist = Territory.radius(state) + c.tideDistance;
    const cx = Math.cos(angle) * dist, cy = Math.sin(angle) * dist;
    const kinds = Vide.SHADOW_KINDS.filter((k) => state.tides >= k.fromTide);
    let budget = tideBudget(state);
    let count = 0;
    while (budget >= 1 && game.shadows.list.length < c.max) {
      const affordable = kinds.filter((k) => k.cost <= budget);
      const k = affordable[Math.floor(r() * affordable.length)];
      budget -= k.cost;
      spawn(game, k.id, cx + (r() - 0.5) * 2 * c.tideSpread, cy + (r() - 0.5) * 2 * c.tideSpread, 'tide');
      count++;
    }
    state.tides++;
    Vide.Sim.emit(game, 'tide', { angle, count, first: state.tides === 1 });
    return count;
  }

  // --- Cibles ---

  function targetPos(t) {
    return t.ref ? t.ref : { x: 0, y: 0 };
  }

  function targetValid(game, t) {
    if (!t) return false;
    if (t.type === 'player') return !game.vitality.invulnerable;
    if (t.type === 'being') return Colony.isActive(t.ref) && game.colony.beings.includes(t.ref);
    if (t.type === 'building') return Structures.isWorking(t.ref);
    if (t.type === 'foyer') return game.state.territory.lit;
    return false;
  }

  // Choisit une proie selon la nature de l'ombre, parmi ce qui est à portée de sens.
  function chooseTarget(game, s) {
    const k = kind(s.kind);
    const sense2 = CONFIG.shadows.sense ** 2;
    const candidates = [];
    const consider = (type, ref, x, y, weight) => {
      const d2 = (x - s.x) ** 2 + (y - s.y) ** 2;
      if (d2 <= sense2) candidates.push({ type, ref, score: d2 * weight });
    };
    const pref = (group) => (k.prefers === 'any' || k.prefers === group ? 1 : 6);

    const { player } = game.state;
    if (!game.vitality.invulnerable) consider('player', player, player.x, player.y, pref('player'));
    for (const b of game.colony.beings) if (Colony.isActive(b)) consider('being', b, b.x, b.y, pref('beings'));
    for (const b of game.state.buildings) if (Structures.isWorking(b)) consider('building', b, b.x, b.y, pref('structures'));
    if (game.state.territory.lit) consider('foyer', null, 0, 0, pref('structures'));

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0] || null;
  }

  function reachOf(t) {
    if (t.type === 'building') return Structures.def(t.ref.type).size;
    if (t.type === 'foyer') return 24;
    return 8;
  }

  // --- Mise à jour ---

  function update(game, dt) {
    const sh = game.shadows;
    const { state } = game;
    const c = CONFIG.shadows;

    // Marées : seulement une fois le territoire assez grand pour attirer les ombres.
    if (state.territory.lit && Territory.radius(state) >= c.firstTideRadius) {
      sh.tideTimer -= dt;
      if (sh.tideTimer <= 0) {
        startTide(game);
        sh.tideTimer = c.tideInterval + (sh.rng() - 0.5) * 2 * c.tideJitter;
      }
    }

    // Errance : hors du territoire, la zone traversée fait surgir ses ombres près du joueur.
    const zone = game.region ? game.region.zone : null;
    const far = Math.hypot(state.player.x, state.player.y) - Territory.radius(state);
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

    for (const s of sh.list) {
      const k = kind(s.kind);
      s.age += dt;
      // Dans le territoire, la lumière ronge lentement les ombres : une marée finit toujours par s'éteindre.
      s.burning = Territory.isInside(state, s.x, s.y);
      if (s.burning) s.hp -= c.territoryBurn * dt;
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
      } else if (s.origin === 'tide' && state.territory.lit) {
        tx = 0; ty = 0; // une marée sans proie en vue avance vers le foyer
      } else {
        tx = state.player.x; ty = state.player.y;
      }
      const dx = tx - s.x, dy = ty - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = s.target ? k.radius + reachOf(s.target) : 0;
      // Mouvement lourd et ondulant, qui s'arrête au contact.
      const speed = d > reach ? k.speed : 0;
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
        sh.list.splice(i, 1);
        continue;
      }
      const fromPlayer = Math.hypot(s.x - state.player.x, s.y - state.player.y);
      const fromFoyer = Math.hypot(s.x, s.y);
      if (fromPlayer > c.despawn && (s.origin === 'roam' || fromFoyer > Territory.radius(state) + c.despawn)) {
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

  Vide.Shadows = { kind, create, spawn, pickKind, tideBudget, startTide, update, damage, nearest };
})(globalThis.Vide);
