// Format de sauvegarde : versionné, migrable, et tolérant aux données abîmées.
// Ce module ne touche pas au stockage du navigateur (voir src/app/storage.js) : il est donc testable.
(function (Vide) {
  'use strict';

  // Version du FORMAT de sauvegarde (pas du jeu). À incrémenter quand la forme de l'état change,
  // en ajoutant la migration correspondante ci-dessous.
  const FORMAT = 17;

  // MIGRATIONS[n] transforme des données au format n en données au format n + 1.
  const MIGRATIONS = {
    // 0.2 : apparition du territoire.
    1: (data) => ({ ...data, territory: { lit: false, area: 0 } }),
    // 0.3 : les êtres de lumière.
    2: (data) => ({ ...data, beings: {}, colonyRate: 0 }),
    // 0.4 : les bâtiments.
    3: (data) => ({ ...data, buildings: [] }),
    // 0.5 : les ombres, les échos et l'armée.
    4: (data) => ({ ...data, echoes: 0, tides: 0, army: { posture: 'garde' } }),
    // 0.6 : les zones du vide.
    5: (data) => ({ ...data, zones: { visited: [], discovered: [] } }),
    // 0.7 : les colosses.
    6: (data) => ({ ...data, colossi: {} }),
    // 0.8 : le récit.
    7: (data) => ({ ...data, lore: [] }),
    // 1.0 : la renaissance.
    8: (data) => ({ ...data, memories: 0, legacy: {}, renaissances: 0, runStart: 0 }),
    // 1.2 : plus de foyer central. L'ancien territoire devient le premier village (des jardins, à l'origine),
    // avec ses êtres, ses bâtiments et son rendement.
    9: (data) => {
      const { territory, beings, buildings, colonyRate, ...rest } = data;
      const villages = [];
      if (territory && territory.lit === true) {
        villages.push({
          id: 1, type: 'jardins', x: 0, y: 0, area: territory.area, cells: [],
          beings: beings || {}, buildings: buildings || [], rate: colonyRate || 0,
        });
      }
      return { ...rest, villages };
    },
    // 1.3 : l'intendant de chaque village (part confiée, réserve).
    10: (data) => ({
      ...data,
      villages: (Array.isArray(data.villages) ? data.villages : []).map((v) => ({ ...v, steward: 0, funds: 0 })),
    }),
    // 1.4 : les routes entre villages.
    11: (data) => ({ ...data, roads: [] }),
    // 1.4 : les ressources de chaque village.
    12: (data) => ({
      ...data,
      villages: (Array.isArray(data.villages) ? data.villages : []).map((v) => ({ ...v, stock: { matiere: 0, savoir: 0 } })),
    }),
    // 1.4 : les cités (spécialités en plus, quartiers).
    13: (data) => ({
      ...data,
      villages: (Array.isArray(data.villages) ? data.villages : []).map((v) => ({ ...v, extra: [], districts: [] })),
    }),
    // 1.5 : les expéditions.
    14: (data) => ({ ...data, expeditions: [] }),
    // 1.5 : le fanal.
    15: (data) => ({ ...data, beacon: null }),
    // 1.6 : les nids d'ombre.
    16: (data) => ({ ...data, nests: [], cleared: [], nestTimer: null }),
  };

  function serialize(state, now) {
    return JSON.stringify({ format: FORMAT, game: Vide.VERSION, savedAt: now, state });
  }

  // Renvoie { ok: true, state, savedAt } ou { ok: false, reason } avec reason parmi :
  //   'corrupt'   illisible ou incomplète
  //   'newer'     créée par une version plus récente du jeu
  //   'migration' une étape de migration manque ou a échoué
  function deserialize(text, migrations, format) {
    migrations = migrations || MIGRATIONS;
    format = format || FORMAT;

    let save;
    try {
      save = JSON.parse(text);
    } catch (e) {
      return { ok: false, reason: 'corrupt' };
    }
    if (!isObject(save) || !Number.isInteger(save.format) || save.format < 1 || !isObject(save.state)) {
      return { ok: false, reason: 'corrupt' };
    }
    if (save.format > format) return { ok: false, reason: 'newer' };

    let data = save.state;
    for (let v = save.format; v < format; v++) {
      if (typeof migrations[v] !== 'function') return { ok: false, reason: 'migration' };
      try {
        data = migrations[v](data);
      } catch (e) {
        return { ok: false, reason: 'migration' };
      }
    }

    return {
      ok: true,
      state: sanitize(data),
      savedAt: Number.isFinite(save.savedAt) ? save.savedAt : null,
    };
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function positive(v, fallback) {
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  }

  function finite(v, fallback) {
    return Number.isFinite(v) ? v : fallback;
  }

  // Reconstruit un état valide à partir de données quelconques : toute valeur absente ou absurde
  // reprend sa valeur par défaut, les niveaux sont bornés, les améliorations inconnues sont ignorées.
  function sanitize(raw) {
    const seed = Number.isFinite(raw.seed) ? raw.seed : 1;
    const state = Vide.State.create(seed);

    state.light = positive(raw.light, 0);
    state.totalLight = Math.max(positive(raw.totalLight, 0), state.light);

    const upgrades = isObject(raw.upgrades) ? raw.upgrades : {};
    const legacy = isObject(raw.legacy) ? raw.legacy : {};
    for (const up of Vide.UPGRADES) {
      const level = (up.legacy ? legacy : upgrades)[up.id];
      if (!Number.isInteger(level) || level <= 0) continue;
      (up.legacy ? state.legacy : state.upgrades)[up.id] = up.max === null ? level : Math.min(level, up.max);
    }
    state.memories = positive(raw.memories, 0);
    state.renaissances = Number.isInteger(raw.renaissances) && raw.renaissances > 0 ? raw.renaissances : 0;
    state.runStart = Math.min(positive(raw.runStart, 0), state.totalLight);

    const player = isObject(raw.player) ? raw.player : {};
    state.player.x = finite(player.x, 0);
    state.player.y = finite(player.y, 0);

    const villages = Array.isArray(raw.villages) ? raw.villages : [];
    for (const v of villages) {
      const village = sanitizeVillage(v);
      if (!village || state.villages.some((o) => o.id === village.id)) continue;
      state.villages.push(village);
      if (state.villages.length >= Vide.CONFIG.villages.max) break;
    }

    // Expéditions : depuis un village existant (sinon elles rentrent au plus proche), membres connus.
    const expeditions = Array.isArray(raw.expeditions) ? raw.expeditions : [];
    for (const e of expeditions) {
      if (!isObject(e) || !Vide.Expeditions.KINDS.includes(e.kind) || state.expeditions.length >= Vide.CONFIG.expeditions.max) continue;
      if (![e.x, e.y, e.tx, e.ty].every(Number.isFinite) || !Number.isInteger(e.id)) continue;
      const members = {};
      const raw2 = isObject(e.members) ? e.members : {};
      for (const id of ['lueur', 'eclaireur', 'gardien']) if (Number.isInteger(raw2[id]) && raw2[id] > 0) members[id] = raw2[id];
      if (!Object.keys(members).length) continue;
      state.expeditions.push({
        id: e.id, kind: e.kind, from: Number.isInteger(e.from) ? e.from : 0, x: e.x, y: e.y, tx: e.tx, ty: e.ty,
        type: e.kind === 'colons' ? (Vide.VILLAGE_TYPES.some((t) => t.id === e.type) ? e.type : 'jardins') : null,
        members, hp: Math.min(positive(e.hp, 1), Vide.Expeditions.hpOf(members)) || 1, back: e.back === true,
      });
    }

    const nests = Array.isArray(raw.nests) ? raw.nests : [];
    for (const n of nests) {
      if (!isObject(n) || !Number.isInteger(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      if (state.nests.some((o) => o.id === n.id) || state.nests.length >= Vide.CONFIG.nests.max * 3) continue;
      const nest = { id: n.id, x: n.x, y: n.y, hp: 0, age: positive(n.age, 0), region: typeof n.region === 'string' ? n.region : null };
      nest.hp = Math.min(positive(n.hp, Vide.Nests.maxHp(nest)), Vide.Nests.maxHp(nest)) || 1;
      state.nests.push(nest);
    }
    const cleared = Array.isArray(raw.cleared) ? raw.cleared : [];
    for (const key of cleared) {
      if (typeof key === 'string' && /^-?\d+,-?\d+$/.test(key) && !state.cleared.includes(key)) state.cleared.push(key);
    }
    state.nestTimer = Number.isFinite(raw.nestTimer) ? Math.max(0, raw.nestTimer) : null;

    const beacon = isObject(raw.beacon) ? raw.beacon : null;
    if (beacon && Number.isFinite(beacon.x) && Number.isFinite(beacon.y)) {
      state.beacon = { x: beacon.x, y: beacon.y, light: positive(beacon.light, 0) };
    }

    // Routes : entre deux villages existants et distincts, une seule par paire, jamais plus longue que bâtie.
    const roads = Array.isArray(raw.roads) ? raw.roads : [];
    for (const r of roads) {
      if (!isObject(r) || r.a === r.b) continue;
      const a = state.villages.find((v) => v.id === r.a), b = state.villages.find((v) => v.id === r.b);
      if (!a || !b || state.roads.some((o) => (o.a === a.id && o.b === b.id) || (o.a === b.id && o.b === a.id))) continue;
      const road = { a: Math.min(a.id, b.id), b: Math.max(a.id, b.id), work: 0 };
      road.work = Math.min(positive(r.work, 0), Math.hypot(a.x - b.x, a.y - b.y));
      state.roads.push(road);
    }

    state.echoes = positive(raw.echoes, 0);
    state.tides = Number.isInteger(raw.tides) && raw.tides > 0 ? raw.tides : 0;
    const army = isObject(raw.army) ? raw.army : {};
    if (Vide.Combat.POSTURES.includes(army.posture)) state.army.posture = army.posture;

    const lore = Array.isArray(raw.lore) ? raw.lore : [];
    for (const id of lore) {
      if (Vide.Lore.get(id) && !state.lore.includes(id)) state.lore.push(id);
    }

    const colossi = isObject(raw.colossi) ? raw.colossi : {};
    for (const d of Vide.COLOSSI) {
      if (['heard', 'found', 'tamed'].includes(colossi[d.id])) state.colossi[d.id] = colossi[d.id];
    }

    const zones = isObject(raw.zones) ? raw.zones : {};
    const visited = Array.isArray(zones.visited) ? zones.visited : [];
    for (const key of visited) {
      if (typeof key === 'string' && /^-?\d+,-?\d+$/.test(key) && !state.zones.visited.includes(key)) {
        state.zones.visited.push(key);
      }
    }
    state.zones.visited = state.zones.visited.slice(-Vide.Zones.MAX_VISITED);
    const discovered = Array.isArray(zones.discovered) ? zones.discovered : [];
    for (const id of discovered) {
      if (Vide.ZONES.some((z) => z.id === id) && !state.zones.discovered.includes(id)) state.zones.discovered.push(id);
    }

    const stats = isObject(raw.stats) ? raw.stats : {};
    state.stats.playTime = positive(stats.playTime, 0);
    state.stats.collected = Math.floor(positive(stats.collected, 0));
    state.stats.shadows = Math.floor(positive(stats.shadows, 0));

    return state;
  }

  function sanitizeVillage(raw) {
    if (!isObject(raw) || !Number.isInteger(raw.id) || raw.id <= 0) return null;
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
    const type = Vide.VILLAGE_TYPES.some((t) => t.id === raw.type) ? raw.type : Vide.VILLAGE_TYPES[0].id;
    const start = Math.PI * Vide.CONFIG.territory.startRadius ** 2;
    const village = {
      id: raw.id, type, x: raw.x, y: raw.y,
      area: Math.max(positive(raw.area, start), start),
      cells: [], beings: {}, buildings: [], rate: positive(raw.rate, 0),
      steward: Vide.Steward.SHARES.includes(raw.steward) ? raw.steward : 0,
      funds: positive(raw.funds, 0),
      stock: { matiere: 0, savoir: 0 },
      extra: [],
      districts: [],
    };
    const known = (t) => Vide.VILLAGE_TYPES.some((x) => x.id === t);
    for (const t of Array.isArray(raw.extra) ? raw.extra : []) {
      if (known(t) && t !== type && !village.extra.includes(t)) village.extra.push(t);
    }
    for (const d of Array.isArray(raw.districts) ? raw.districts : []) {
      if (isObject(d) && Number.isFinite(d.x) && Number.isFinite(d.y) && known(d.type) && village.districts.length < 40) {
        village.districts.push({ x: d.x, y: d.y, type: d.type });
      }
    }
    const stock = isObject(raw.stock) ? raw.stock : {};
    for (const res of Vide.RESOURCES) village.stock[res.id] = Math.min(Vide.CONFIG.trade.cap, positive(stock[res.id], 0));
    const beings = isObject(raw.beings) ? raw.beings : {};
    for (const sp of Vide.SPECIES) {
      const n = beings[sp.id];
      if (Number.isInteger(n) && n > 0) village.beings[sp.id] = n;
    }
    const buildings = Array.isArray(raw.buildings) ? raw.buildings : [];
    for (const b of buildings) {
      if (!isObject(b)) continue;
      const def = Vide.BUILDINGS.find((d) => d.id === b.type);
      if (!def || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      const building = { type: b.type, x: b.x, y: b.y, work: Math.min(positive(b.work, 0), def.work) };
      if (b.broken === true && building.work >= def.work) building.broken = true;
      village.buildings.push(building);
    }
    // Forme : cellules entières, sans doublon, blanc de 0 à 100 ; jamais plus que la surface n'en permet.
    // Ce qui manque (sauvegarde ancienne ou abîmée) repousse aussitôt à partir du cœur.
    const cells = Array.isArray(raw.cells) ? raw.cells : [];
    const max = Vide.Territory.targetCells(village);
    const seen = new Set();
    for (let k = 0; k + 2 < cells.length && village.cells.length / 3 < max; k += 3) {
      const [i, j, w] = [cells[k], cells[k + 1], cells[k + 2]];
      if (!Number.isInteger(i) || !Number.isInteger(j) || Math.abs(j) >= 1048576) continue;
      if (seen.has(`${i},${j}`)) continue;
      seen.add(`${i},${j}`);
      village.cells.push(i, j, Number.isFinite(w) ? Math.round(Math.min(100, Math.max(0, w))) : 0);
    }
    Vide.Territory.grow(village);
    return village;
  }

  // --- Codes de sauvegarde (exporter / importer) ---
  // Un code est « vide: » suivi de la sauvegarde en base64 : une seule ligne, facile à copier et à coller.
  const CODE_PREFIX = 'vide:';
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function encode64(text) {
    const bytes = unescape(encodeURIComponent(text)); // octets UTF-8, un par caractère
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes.charCodeAt(i) << 16) | ((bytes.charCodeAt(i + 1) || 0) << 8) | (bytes.charCodeAt(i + 2) || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
      out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
      out += i + 2 < bytes.length ? B64[n & 63] : '=';
    }
    return out;
  }

  function decode64(code) {
    const clean = code.replace(/[^A-Za-z0-9+/]/g, '');
    let bytes = '';
    for (let i = 0; i < clean.length; i += 4) {
      const chunk = clean.slice(i, i + 4);
      let n = 0;
      for (let j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]) : 0);
      bytes += String.fromCharCode((n >> 16) & 255);
      if (chunk.length > 2) bytes += String.fromCharCode((n >> 8) & 255);
      if (chunk.length > 3) bytes += String.fromCharCode(n & 255);
    }
    return decodeURIComponent(escape(bytes));
  }

  function exportCode(state, now) {
    return CODE_PREFIX + encode64(serialize(state, now));
  }

  // Accepte un code (espaces et retours à la ligne tolérés) ou une sauvegarde brute en JSON.
  // Renvoie le même résultat que deserialize.
  function importCode(text) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed.startsWith('{')) return deserialize(trimmed);
    if (!trimmed.startsWith(CODE_PREFIX)) return { ok: false, reason: 'corrupt' };
    let json;
    try {
      json = decode64(trimmed.slice(CODE_PREFIX.length));
    } catch (e) {
      return { ok: false, reason: 'corrupt' };
    }
    return deserialize(json);
  }

  Vide.Save = { FORMAT, serialize, deserialize, sanitize, exportCode, importCode, encode64, decode64 };
})(globalThis.Vide);
