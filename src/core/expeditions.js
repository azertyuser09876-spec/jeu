// Expéditions, choisies sur la carte. Elles partent du village le plus proche du but et marchent vraiment :
// les ombres peuvent les attaquer en chemin.
//   Éclaireurs  révèlent les régions autour du but, puis rentrent.
//   Colons      trois lueurs du village vont fonder, au but, un village du type choisi (au prix d'une fondation).
//   Escorte     (en option) deux soldats du village accompagnent l'expédition, combattent en chemin, et restent
//               avec les colons (ou rentrent avec les éclaireurs).
// État persistant : state.expeditions = [{ id, kind, from, x, y, tx, ty, type, members, hp, back }].
(function (Vide) {
  'use strict';
  const { CONFIG, Villages, Colony, Territory, Zones } = Vide;

  const KINDS = ['scouts', 'colons'];

  function armyIn(v) {
    let n = 0;
    for (const sp of Vide.SPECIES) if (sp.army) n += v.beings[sp.id] || 0;
    return n;
  }

  // Village d'où partirait une expédition vers (tx, ty) : le plus proche du but qui a ce qu'il faut.
  function origin(state, kind, tx, ty, escort) {
    const e = CONFIG.expeditions;
    let best = null;
    let bestD = Infinity;
    for (const v of state.villages) {
      if (kind === 'colons' && (v.beings.lueur || 0) < e.colonists) continue;
      if (escort && (v.beings.gardien || 0) < e.escort) continue;
      const d = Math.hypot(v.x - tx, v.y - ty);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  function cost(state, kind, tx, ty, from) {
    if (kind === 'colons') return { light: Villages.foundCost(state) };
    const d = from ? Math.hypot(from.x - tx, from.y - ty) : 0;
    return { light: Math.ceil(CONFIG.expeditions.scoutCost * d) };
  }

  // Raison qui empêche cette expédition, ou null.
  function blocked(state, kind, tx, ty, escort) {
    const e = CONFIG.expeditions;
    if (!state.villages.length) return 'il faut un village';
    if (state.expeditions.length >= e.max) return 'trop d’expéditions en route';
    const from = origin(state, kind, tx, ty, escort);
    if (!from) {
      if (kind === 'colons') return `il faut ${e.colonists} lueurs dans un village`;
      return `il faut ${e.escort} gardiens pour l’escorte`;
    }
    if (Math.hypot(from.x - tx, from.y - ty) > e.range) return 'trop loin';
    if (kind === 'colons') {
      for (const v of state.villages) {
        if (Math.hypot(v.x - tx, v.y - ty) - Territory.radius(v) < CONFIG.villages.gap) return 'trop près d’un village';
      }
    }
    if (state.light < cost(state, kind, tx, ty, from).light) return 'pas assez de lumière';
    return null;
  }

  // Lance une expédition (paie et retire ses membres du village). Renvoie l'expédition, ou null.
  function launch(state, kind, tx, ty, opts) {
    const o = opts || {};
    if (!KINDS.includes(kind) || blocked(state, kind, tx, ty, o.escort)) return null;
    const e = CONFIG.expeditions;
    const from = origin(state, kind, tx, ty, o.escort);
    state.light -= cost(state, kind, tx, ty, from).light;
    const members = kind === 'colons' ? { lueur: e.colonists } : { eclaireur: e.scouts };
    if (o.escort) members.gardien = e.escort;
    for (const [id, n] of Object.entries(members)) if (from.beings[id]) from.beings[id] -= n;
    const exp = {
      id: state.expeditions.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      kind,
      from: from.id,
      x: from.x,
      y: from.y,
      tx,
      ty,
      type: kind === 'colons' ? Villages.type(o.type || 'jardins').id : null,
      members,
      hp: hpOf(members),
      back: false,
    };
    state.expeditions.push(exp);
    return exp;
  }

  // Vitalité d'une expédition : celle de ses membres (les éclaireurs comptent comme des lueurs).
  function hpOf(members) {
    let hp = 0;
    for (const [id, n] of Object.entries(members)) hp += n * (id === 'eclaireur' ? 25 : Colony.species(id).hp);
    return hp;
  }

  // Les éclaireurs révèlent les régions dans un rayon autour du but. Renvoie les types de zones découverts.
  function reveal(state, x, y) {
    const r = CONFIG.expeditions.reveal;
    const step = Zones.CELL / 3;
    const found = [];
    for (let dx = -r; dx <= r; dx += step) {
      for (let dy = -r; dy <= r; dy += step) {
        if (dx * dx + dy * dy > r * r) continue;
        const region = Zones.at(state.seed, x + dx, y + dy);
        if (Zones.visit(state, region)) found.push(region.zone.id);
      }
    }
    return found;
  }

  // Arrivée au but. Renvoie un événement à annoncer.
  function arrive(state, exp) {
    if (exp.kind === 'scouts') {
      const found = reveal(state, exp.tx, exp.ty);
      exp.back = true;
      return { type: 'scouted', zones: found };
    }
    // Colons : fondent leur village (ou, si la place est prise, rejoignent le village le plus proche).
    const free = state.villages.every((v) => Math.hypot(v.x - exp.tx, v.y - exp.ty) - Territory.radius(v) >= CONFIG.villages.gap * 0.5);
    remove(state, exp); // (avant de fonder : le prix des fondations compte les colons en route)
    const home = free ? Villages.found(state, exp.type, { x: exp.tx, y: exp.ty }) : Villages.nearest(state, exp.tx, exp.ty);
    for (const [id, n] of Object.entries(exp.members)) home.beings[id] = (home.beings[id] || 0) + n;
    return { type: free ? 'settled' : 'colonsJoined', village: home.type, x: home.x, y: home.y };
  }

  // De retour au village de départ (éclaireurs) : les membres y retrouvent leur place.
  function homecoming(state, exp) {
    const home = Villages.byId(state, exp.from) || Villages.nearest(state, exp.x, exp.y);
    if (home) {
      for (const [id, n] of Object.entries(exp.members)) {
        if (id !== 'eclaireur') home.beings[id] = (home.beings[id] || 0) + n;
      }
    }
    remove(state, exp);
  }

  function remove(state, exp) {
    const i = state.expeditions.indexOf(exp);
    if (i >= 0) state.expeditions.splice(i, 1);
  }

  // Où marche l'expédition : vers son but, puis (éclaireurs) vers son village.
  function goal(state, exp) {
    if (!exp.back) return { x: exp.tx, y: exp.ty };
    const home = Villages.byId(state, exp.from) || Villages.nearest(state, exp.x, exp.y);
    return home ? { x: home.x, y: home.y } : { x: 0, y: 0 };
  }

  // Avance une expédition de `seconds` secondes. Renvoie l'événement d'arrivée éventuel.
  function move(state, exp, seconds) {
    const { x: gx, y: gy } = goal(state, exp);
    const d = Math.hypot(gx - exp.x, gy - exp.y);
    const step = CONFIG.expeditions.speed * seconds;
    if (step < d) {
      exp.x += ((gx - exp.x) / d) * step;
      exp.y += ((gy - exp.y) / d) * step;
      return null;
    }
    exp.x = gx;
    exp.y = gy;
    if (exp.back) {
      homecoming(state, exp);
      return { type: 'returned' };
    }
    return arrive(state, exp);
  }

  // Les ombres blessent les expéditions (voir Combat.strike) ; à zéro, elle est perdue.
  function hurt(state, exp, amount) {
    exp.hp -= amount;
    if (exp.hp > 0) return false;
    remove(state, exp);
    return true;
  }

  // Pendant le jeu : marche, combat de l'escorte, arrivées. Attaquée, une expédition s'arrête pour faire face
  // (sans quoi elle distancerait presque toutes les ombres) : l'escorte frappe l'ombre la plus proche.
  function update(game, dt) {
    const { state } = game;
    for (const exp of state.expeditions.slice()) {
      const foe = Vide.Shadows.nearest(game, exp.x, exp.y, CONFIG.expeditions.engage);
      const guards = exp.members.gardien || 0;
      if (foe && guards) {
        const sp = Colony.species('gardien');
        Vide.Shadows.damage(foe, (sp.damage / sp.cooldown) * guards * game.stats.armyDamage * dt);
      }
      // (Qui combat : pour l'affichage seulement, jamais sauvegardé.)
      if (foe) game.expeditionsFighting.add(exp);
      else game.expeditionsFighting.delete(exp);
      if (foe) continue;
      const event = move(state, exp, dt);
      if (event) Vide.Sim.emit(game, event.type, { ...event, kind: exp.kind });
    }
  }

  // Pendant l'absence : elles marchent sans combattre (aller, puis retour des éclaireurs). Renvoie les événements.
  function offline(state, seconds) {
    const events = [];
    for (const exp of state.expeditions.slice()) {
      let left = seconds;
      while (left > 0 && state.expeditions.includes(exp)) {
        const g = goal(state, exp);
        const need = Math.hypot(g.x - exp.x, g.y - exp.y) / CONFIG.expeditions.speed;
        const event = move(state, exp, Math.min(left, need));
        left -= need;
        if (event) events.push(event);
      }
    }
    return events;
  }

  Vide.Expeditions = { KINDS, origin, cost, blocked, launch, hpOf, reveal, arrive, goal, move, hurt, update, offline };
})(globalThis.Vide);
