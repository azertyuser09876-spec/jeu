// Expéditions, choisies sur la carte. Elles partent du village le plus proche du but et marchent vraiment :
// les ombres peuvent les attaquer en chemin.
//   Éclaireurs  révèlent les régions autour du but, puis rentrent.
//   Colons      trois lueurs du village vont fonder, au but, un village du type choisi (au prix d'une fondation).
//   Sapeurs     deux bâtisseurs du village vont bâtir sur place un engin de siège (baliste ou chaîne, voir
//               engines.js), puis rentrent.
//   Érudits     vont observer un colosse depuis un abri, à distance de son repaire : chaque étude dévoile l'un de
//               ses sceaux (voir Colossus.revealed) ; tous dévoilés, ils rentrent. Plus rapides si leur village a
//               du savoir ✎.
//   Escorte     (en option) deux soldats du village accompagnent l'expédition, combattent en chemin, et restent
//               avec les colons (ou rentrent avec les éclaireurs et les érudits).
// État persistant : state.expeditions = [{ id, kind, from, x, y, tx, ty, type, members, hp, back }] ; les érudits
// ont en plus { colossus, study } (study : secondes d'observation de l'étude en cours, null en chemin) ; les sapeurs
// { engine, site } (engine : 'baliste' ou 'chaine' ; site : id de l'engin en chantier, null en chemin).
(function (Vide) {
  'use strict';
  const { CONFIG, Villages, Colony, Territory, Zones } = Vide;

  const KINDS = ['scouts', 'colons', 'scholars', 'sappers'];

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
      if (kind === 'sappers' && (v.beings.batisseur || 0) < CONFIG.engines.sappers) continue;
      if (escort && (v.beings.gardien || 0) < e.escort) continue;
      const d = Math.hypot(v.x - tx, v.y - ty);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // `what` : l'engin à bâtir (sapeurs).
  function cost(state, kind, tx, ty, from, what) {
    if (kind === 'colons') return { light: Villages.foundCost(state) };
    if (kind === 'sappers') return { light: CONFIG.engines.cost[what] || 0 };
    const d = from ? Math.hypot(from.x - tx, from.y - ty) : 0;
    const per = kind === 'scholars' ? CONFIG.expeditions.scholarCost : CONFIG.expeditions.scoutCost;
    return { light: Math.ceil(per * d) };
  }

  // Colosse que des érudits pourraient étudier près de (x, y) (dans `radius`), ou null : entendu ou rencontré,
  // pas encore apaisé, des sceaux encore voilés.
  function studyable(state, x, y, radius) {
    let best = null;
    let bestD = radius;
    for (const d of Vide.COLOSSI) {
      const st = Vide.Colossus.status(state, d.id);
      if (st !== 'heard' && st !== 'found') continue;
      if (Vide.Colossus.revealed(state, d.id) >= d.seals.length) continue;
      const at = Vide.Colossus.lair(state, d);
      const dist = Math.hypot(at.x - x, at.y - y);
      if (dist < bestD) {
        bestD = dist;
        best = d.id;
      }
    }
    return best;
  }

  // Abri d'où observer un colosse : à bonne distance de son repaire, du côté du village le plus proche.
  function studySpot(state, id) {
    const at = Vide.Colossus.lair(state, Vide.Colossus.def(id));
    const home = Villages.nearest(state, at.x, at.y);
    const dx = home ? home.x - at.x : 1, dy = home ? home.y - at.y : 0;
    const d = Math.hypot(dx, dy) || 1;
    const r = Math.min(CONFIG.expeditions.studyRange, d);
    return { x: at.x + (dx / d) * r, y: at.y + (dy / d) * r };
  }

  // Raison qui empêche cette expédition, ou null. `what` : le colosse à étudier (érudits) ou l'engin à bâtir
  // (sapeurs).
  function blocked(state, kind, tx, ty, escort, what) {
    const e = CONFIG.expeditions;
    if (!state.villages.length) return 'il faut un village';
    if (state.expeditions.length >= e.max) return 'trop d’expéditions en route';
    if (kind === 'scholars') {
      if (!what) return 'aucun colosse à étudier ici';
      if (state.expeditions.some((x) => x.kind === 'scholars' && x.colossus === what)) return 'des érudits l’étudient déjà';
    }
    if (kind === 'sappers') {
      if (!Vide.Engines.def(what)) return 'quel engin ?';
      const planned = state.expeditions.filter((x) => x.kind === 'sappers' && x.site === null).length;
      if (state.engines.length + planned >= CONFIG.engines.max) return 'assez d’engins';
    }
    const from = origin(state, kind, tx, ty, escort);
    if (!from) {
      if (kind === 'colons') return `il faut ${e.colonists} lueurs dans un village`;
      if (kind === 'sappers') return `il faut ${CONFIG.engines.sappers} bâtisseurs dans un village`;
      return `il faut ${e.escort} gardiens pour l’escorte`;
    }
    if (Math.hypot(from.x - tx, from.y - ty) > e.range) return 'trop loin';
    if (kind === 'colons') {
      for (const v of state.villages) {
        if (Math.hypot(v.x - tx, v.y - ty) - Territory.radius(v) < CONFIG.villages.gap) return 'trop près d’un village';
      }
    }
    if (state.light < cost(state, kind, tx, ty, from, what).light) return 'pas assez de lumière';
    return null;
  }

  // Lance une expédition (paie et retire ses membres du village). Renvoie l'expédition, ou null.
  function launch(state, kind, tx, ty, opts) {
    const o = opts || {};
    const what = kind === 'sappers' ? o.engine : o.colossus;
    if (!KINDS.includes(kind) || blocked(state, kind, tx, ty, o.escort, what)) return null;
    const e = CONFIG.expeditions;
    const from = origin(state, kind, tx, ty, o.escort);
    state.light -= cost(state, kind, tx, ty, from, what).light;
    const members = {
      colons: { lueur: e.colonists }, scholars: { erudit: e.scholars }, sappers: { batisseur: CONFIG.engines.sappers },
    }[kind] || { eclaireur: e.scouts };
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
    if (kind === 'scholars') {
      exp.colossus = o.colossus;
      exp.study = null;
    }
    if (kind === 'sappers') {
      exp.engine = o.engine;
      exp.site = null;
    }
    state.expeditions.push(exp);
    return exp;
  }

  // Vitalité d'une expédition : celle de ses membres (les éclaireurs comptent comme des lueurs).
  function hpOf(members) {
    let hp = 0;
    for (const [id, n] of Object.entries(members)) hp += n * (id === 'eclaireur' || id === 'erudit' ? 25 : Colony.species(id).hp);
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
    if (exp.kind === 'scholars') {
      exp.study = 0;
      return { type: 'studying', id: exp.colossus };
    }
    if (exp.kind === 'sappers') {
      exp.site = Vide.Engines.add(state, exp.engine, exp.tx, exp.ty, 0).id;
      return { type: 'siteStarted', engine: exp.engine };
    }
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
        if (id !== 'eclaireur' && id !== 'erudit') home.beings[id] = (home.beings[id] || 0) + n;
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

  // Vitesse d'étude : doublée si le village des érudits a du savoir.
  function studySpeed(state, exp) {
    const home = Villages.byId(state, exp.from);
    return home && home.stock && home.stock.savoir > 0 ? CONFIG.expeditions.knowledgeSpeed : 1;
  }

  // Les érudits observent `seconds` secondes. Chaque étude achevée dévoile un sceau ; quand il n'y a plus rien à
  // apprendre (ou que le colosse est apaisé), ils rentrent. Renvoie les événements, et le temps restant.
  function observe(state, exp, seconds) {
    const C = Vide.Colossus;
    const d = C.def(exp.colossus);
    const events = [];
    let left = seconds;
    while (left > 0 && !exp.back) {
      if (C.status(state, d.id) === 'tamed' || C.revealed(state, d.id) >= d.seals.length) {
        exp.back = true;
        exp.study = null;
        break;
      }
      const need = (CONFIG.expeditions.studyTime - exp.study) / studySpeed(state, exp);
      if (need > left) {
        exp.study += left * studySpeed(state, exp);
        left = 0;
        break;
      }
      left -= need;
      exp.study = 0;
      C.study(state, d.id);
      events.push({ type: 'studied', id: d.id, revealed: C.revealed(state, d.id), total: d.seals.length });
    }
    return { events, left };
  }

  const observing = (exp) => exp.kind === 'scholars' && !exp.back && exp.study !== null;
  const building = (exp) => exp.kind === 'sappers' && !exp.back && exp.site !== null;

  // Les sapeurs bâtissent `seconds` secondes. L'engin achevé (ou détruit en chantier), ils rentrent.
  // Renvoie les événements, et le temps restant.
  function erect(state, exp, seconds) {
    const site = Vide.Engines.byId(state, exp.site);
    if (!site) {
      exp.back = true;
      return { events: [{ type: 'siteLost', engine: exp.engine }], left: seconds };
    }
    const need = (1 - site.built) * CONFIG.engines.buildTime;
    if (need > seconds) {
      site.built += seconds / CONFIG.engines.buildTime;
      return { events: [], left: 0 };
    }
    site.built = 1;
    exp.back = true;
    return { events: [{ type: 'engineBuilt', engine: exp.engine, x: site.x, y: site.y }], left: seconds - need };
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
      if (observing(exp) || building(exp)) {
        for (const event of (observing(exp) ? observe : erect)(state, exp, dt).events) Vide.Sim.emit(game, event.type, event);
        continue;
      }
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
        if (observing(exp) || building(exp)) {
          const done = (observing(exp) ? observe : erect)(state, exp, left);
          events.push(...done.events);
          left = done.left;
          continue;
        }
        const g = goal(state, exp);
        const need = Math.hypot(g.x - exp.x, g.y - exp.y) / CONFIG.expeditions.speed;
        const event = move(state, exp, Math.min(left, need));
        left -= need;
        if (event) events.push(event);
      }
    }
    return events;
  }

  Vide.Expeditions = {
    KINDS, origin, cost, studyable, studySpot, blocked, launch, hpOf, reveal, arrive, goal, move, studySpeed, observe, erect,
    hurt, update, offline,
  };
})(globalThis.Vide);
