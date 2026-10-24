// Les cités : quand deux territoires se touchent, les villages fusionnent ; un village devenu immense peut aussi
// ajouter une spécialisation. Une cité garde toutes les spécialisations de ses villages (village.extra), et les
// anciens cœurs y deviennent des quartiers (village.districts = [{ x, y, type }]).
(function (Vide) {
  'use strict';
  const { CONFIG, Catalog, Territory, Villages } = Vide;

  const CHECK = 2; // secondes entre deux recherches de villages qui se touchent

  function isCity(v) {
    return (v.extra || []).length > 0;
  }

  function types(v) {
    return [v.type, ...(v.extra || [])];
  }

  // Les territoires de a et b se touchent-ils (une cellule de l'un contre une cellule de l'autre) ?
  function touching(a, b) {
    const ra = Territory.radius(a), rb = Territory.radius(b);
    // Formes irrégulières : on ne regarde les cellules que si les cœurs sont assez proches.
    if (Math.hypot(a.x - b.x, a.y - b.y) > (ra + rb) * 1.6 + 4 * CONFIG.territory.cell) return false;
    const [small, big] = a.cells.length <= b.cells.length ? [a, b] : [b, a];
    for (let k = 0; k < small.cells.length; k += 3) {
      const i = small.cells[k], j = small.cells[k + 1];
      if (Territory.has(big, i, j) || Territory.has(big, i + 1, j) || Territory.has(big, i - 1, j) ||
        Territory.has(big, i, j + 1) || Territory.has(big, i, j - 1)) return true;
    }
    return false;
  }

  // Fusionne `gone` dans `keep` (état persistant seulement ; la simulation remet ensuite ses êtres à jour).
  function merge(state, keep, gone) {
    keep.area += gone.area;
    // Cellules : l'union des deux formes (le blanc le plus avancé l'emporte).
    const cells = keep.cells.slice();
    const at = new Map();
    for (let k = 0; k < cells.length; k += 3) at.set(`${cells[k]},${cells[k + 1]}`, k);
    for (let k = 0; k < gone.cells.length; k += 3) {
      const id = `${gone.cells[k]},${gone.cells[k + 1]}`;
      if (at.has(id)) cells[at.get(id) + 2] = Math.max(cells[at.get(id) + 2], gone.cells[k + 2]);
      else cells.push(gone.cells[k], gone.cells[k + 1], gone.cells[k + 2]);
    }
    keep.cells = cells;
    for (const [id, n] of Object.entries(gone.beings)) keep.beings[id] = (keep.beings[id] || 0) + n;
    keep.buildings.push(...gone.buildings);
    keep.rate += gone.rate;
    keep.funds += gone.funds;
    keep.steward = Math.max(keep.steward, gone.steward);
    for (const res of Vide.RESOURCES) {
      keep.stock[res.id] = Math.min(CONFIG.trade.cap, keep.stock[res.id] + gone.stock[res.id]);
    }
    keep.extra = [...new Set([...keep.extra, ...types(gone)])].filter((t) => t !== keep.type);
    keep.districts.push({ x: gone.x, y: gone.y, type: gone.type }, ...gone.districts);

    // Les routes de l'un passent à l'autre ; celle qui les reliait n'a plus lieu d'être.
    const roads = [];
    for (const r of state.roads) {
      const a = r.a === gone.id ? keep.id : r.a, b = r.b === gone.id ? keep.id : r.b;
      if (a === b) continue;
      const road = { a: Math.min(a, b), b: Math.max(a, b), work: r.work };
      const same = roads.find((o) => o.a === road.a && o.b === road.b);
      if (same) same.work = Math.max(same.work, road.work);
      else roads.push(road);
    }
    state.roads = roads;
    state.villages.splice(state.villages.indexOf(gone), 1);
    Territory.grow(keep);
  }

  // Cherche les villages qui se touchent et les fusionne (le plus vaste absorbe l'autre).
  // Renvoie les fusions faites : [{ keep, gone }].
  function fuse(state) {
    const merges = [];
    for (let again = true; again;) {
      again = false;
      for (const a of state.villages) {
        for (const b of state.villages) {
          if (a.id >= b.id || !touching(a, b)) continue;
          const [keep, gone] = a.area >= b.area ? [a, b] : [b, a];
          merge(state, keep, gone);
          merges.push({ keep, gone });
          again = true;
          break;
        }
        if (again) break;
      }
    }
    return merges;
  }

  // Pendant le jeu : les villages qui se touchent fusionnent ; leurs êtres, leur jardin et leurs caravanes
  // suivent la cité.
  function update(game, dt) {
    game.cityClock = (game.cityClock || 0) + dt;
    if (game.cityClock < CHECK || game.state.villages.length < 2) return;
    game.cityClock = 0;
    for (const { keep, gone } of fuse(game.state)) {
      for (const b of game.colony.beings) if (b.village === gone) b.village = keep;
      for (const p of game.garden.particles) if (p.village === gone.id) p.village = keep.id;
      game.trade.caravans = game.trade.caravans.filter((c) => c.from !== gone && c.to !== gone);
      Vide.Sim.emit(game, 'city', { types: types(keep), x: gone.x, y: gone.y });
    }
  }

  // --- Spécialisations achetées (village devenu immense, ou déjà une cité) ---

  function canSpecialize(v) {
    return isCity(v) || Territory.radius(v) >= CONFIG.cities.radius;
  }

  function specializeCost(v) {
    const c = CONFIG.cities;
    return { light: Math.ceil(c.cost * Math.pow(c.growth, (v.extra || []).length)) };
  }

  for (const t of Vide.VILLAGE_TYPES) {
    Catalog.register({
      id: 'specialite-' + t.id,
      tab: 'village',
      group: 'cité',
      name: `Spécialité : ${t.name.toLowerCase()}`,
      desc: `Ce village devient une cité, et ajoute à ses spécialités celle des ${t.name.toLowerCase()} `
        + `(${t.effectText}).`,
      revealed: (state) => {
        const v = Villages.current(state);
        return Boolean(v && canSpecialize(v) && !types(v).includes(t.id));
      },
      cost: (state) => {
        const v = Villages.current(state);
        return v ? specializeCost(v) : {};
      },
      blocked: (state) => (Villages.current(state) ? null : 'rejoins un village'),
      apply: (state) => { Villages.current(state).extra.push(t.id); },
      effect: () => t.effectText,
    });
  }

  Vide.Cities = { isCity, types, touching, merge, fuse, update, canSpecialize, specializeCost };
})(globalThis.Vide);
