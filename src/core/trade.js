// Ressources et échanges entre villages reliés.
//   Atelier       produit de la matière ◇ ; tant qu'un village en a, ses chantiers avancent bien plus vite.
//   Observatoire  produit du savoir ✎ ; tant qu'un village en a, son territoire grandit plus vite.
//   Bastion       forme des soldats (gardiens) avec la réserve de son intendant, et les envoie aux villages reliés
//                 mal défendus, qui les paient en lumière de leur propre réserve.
// Les surplus voyagent en caravanes le long des routes achevées. État persistant : village.stock = { matiere, savoir }.
// Une caravane n'enlève sa charge à l'expéditeur qu'en arrivant : rien ne se perd si l'on quitte en route.
(function (Vide) {
  'use strict';
  const { CONFIG, Villages, Colony, Roads } = Vide;

  // Ressources : qui les produit, et ce qu'elles font à un village qui en a.
  Vide.RESOURCES = [
    { id: 'matiere', name: 'matière', glyph: '◇', producer: 'atelier', color: [255, 196, 140] },
    { id: 'savoir', name: 'savoir', glyph: '✎', producer: 'observatoire', color: [170, 200, 255] },
  ];

  function hasType(v, typeId) {
    return v.type === typeId || (v.extra || []).includes(typeId);
  }

  function armyIn(v) {
    let n = 0;
    for (const sp of Vide.SPECIES) if (sp.army) n += v.beings[sp.id] || 0;
    return n;
  }

  // Défenseurs souhaités pour un village, selon sa taille.
  function need(v) {
    return 2 + Math.floor(Vide.Territory.radius(v) / 250);
  }

  // Effets des ressources en stock sur les caractéristiques d'un village (appelé par Villages.local).
  function modify(v, stats) {
    const t = CONFIG.trade;
    if (v.stock && v.stock.matiere > 0) stats.buildRate *= t.matterBoost;
    if (v.stock && v.stock.savoir > 0) stats.territoryGrowth *= t.knowledgeBoost;
  }

  // Production et consommation des ressources d'un village pendant `seconds` secondes.
  function produce(v, seconds) {
    const t = CONFIG.trade;
    let pop = 0;
    for (const n of Object.values(v.beings)) pop += n;
    const s = v.stock;
    if (hasType(v, 'atelier')) s.matiere += t.matterRate * pop * seconds;
    if (hasType(v, 'observatoire')) s.savoir += t.knowledgeRate * pop * seconds;
    s.matiere = Math.max(0, Math.min(t.cap, s.matiere - t.matterUse * (v.beings.batisseur || 0) * seconds));
    s.savoir = Math.max(0, Math.min(t.cap, s.savoir - t.knowledgeUse * seconds));
  }

  // Un bastion forme un gardien s'il a de la place et de quoi le payer (réserve de l'intendant, en lumière).
  function train(state, v) {
    if (!hasType(v, 'bastion')) return false;
    const room = Colony.room(state, v, Colony.species('gardien'));
    const price = Colony.cost(state, Colony.species('gardien')).light;
    if (room.used >= room.max || v.funds < price) return false;
    v.funds -= price;
    v.beings.gardien = (v.beings.gardien || 0) + 1;
    return true;
  }

  // Ce qu'une caravane emporterait de `from` vers `to`, ou null.
  function shipment(state, from, to) {
    const t = CONFIG.trade;
    for (const res of Vide.RESOURCES) {
      const have = from.stock[res.id], want = to.stock[res.id];
      if (have > t.surplus && want < t.want) {
        return { kind: res.id, amount: Math.min(t.load, have - t.surplus) };
      }
    }
    // Soldats : d'un bastion bien gardé vers un village qui en manque et peut les payer.
    if (hasType(from, 'bastion') && (from.beings.gardien || 0) > 0 && armyIn(from) > need(from) && armyIn(to) < need(to)) {
      const price = Math.ceil(Colony.cost(state, Colony.species('gardien')).light * t.soldierPrice);
      if (to.funds >= price) return { kind: 'soldat', amount: 1, price };
    }
    return null;
  }

  // Arrivée d'une caravane : la charge passe de l'expéditeur au destinataire (s'ils existent encore).
  function deliver(state, c) {
    if (!state.villages.includes(c.from) || !state.villages.includes(c.to)) return false;
    if (c.kind === 'soldat') {
      if (!(c.from.beings.gardien > 0) || c.to.funds < c.price) return false;
      c.from.beings.gardien--;
      c.to.beings.gardien = (c.to.beings.gardien || 0) + 1;
      c.to.funds -= c.price;
      c.from.funds += c.price;
      return true;
    }
    const amount = Math.min(c.amount, c.from.stock[c.kind]);
    c.from.stock[c.kind] -= amount;
    c.to.stock[c.kind] = Math.min(CONFIG.trade.cap, c.to.stock[c.kind] + amount);
    return amount > 0;
  }

  function create(game) {
    game.trade = { caravans: [], clock: 0, trainClock: 0 };
  }

  // Pendant le jeu : production, formation des soldats, départs et arrivées des caravanes.
  function update(game, dt) {
    const { state } = game;
    const t = CONFIG.trade;
    const tr = game.trade;
    for (const v of state.villages) produce(v, dt);

    tr.trainClock += dt;
    if (tr.trainClock >= t.trainEvery) {
      tr.trainClock = 0;
      for (const v of state.villages) if (train(state, v)) Vide.Sim.emit(game, 'trained', { village: v.type });
    }

    for (let i = tr.caravans.length - 1; i >= 0; i--) {
      const c = tr.caravans[i];
      c.t += dt;
      if (c.t < c.duration) continue;
      tr.caravans.splice(i, 1);
      if (deliver(state, c)) Vide.Sim.emit(game, 'caravan', { kind: c.kind, from: c.from.type, to: c.to.type });
    }

    tr.clock += dt;
    if (tr.clock < t.every) return;
    tr.clock = 0;
    for (const road of state.roads) {
      if (!Roads.isDone(state, road)) continue;
      const [a, b] = Roads.ends(state, road);
      for (const [from, to] of [[a, b], [b, a]]) {
        if (tr.caravans.some((c) => c.from === from && c.to === to)) continue; // une à la fois par sens
        const load = shipment(state, from, to);
        if (!load) continue;
        const duration = Vide.Roads.pathLength(Vide.Roads.route(state, from, to)) / t.caravanSpeed;
        tr.caravans.push({ from, to, ...load, t: 0, duration });
        Vide.Sim.emit(game, 'caravanOut', { kind: load.kind, from: from.type, to: to.type });
      }
    }
  }

  // Pendant l'absence : production et consommation, puis les surplus se partagent le long des routes.
  function offline(state, seconds) {
    const t = CONFIG.trade;
    for (const v of state.villages) produce(v, seconds);
    const rounds = Math.min(200, Math.floor(seconds / t.every));
    for (let k = 0; k < rounds; k++) {
      let moved = false;
      for (const road of state.roads) {
        if (!Roads.isDone(state, road)) continue;
        const [a, b] = Roads.ends(state, road);
        for (const [from, to] of [[a, b], [b, a]]) {
          const load = shipment(state, from, to);
          if (load && load.kind !== 'soldat') moved = deliver(state, { from, to, ...load }) || moved;
        }
      }
      if (!moved) break;
    }
  }

  Vide.Trade = { hasType, armyIn, need, modify, produce, train, shipment, deliver, create, update, offline };
})(globalThis.Vide);
