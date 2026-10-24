// Format de sauvegarde : versionné, migrable, et tolérant aux données abîmées.
// Ce module ne touche pas au stockage du navigateur (voir src/app/storage.js) : il est donc testable.
(function (Vide) {
  'use strict';

  // Version du FORMAT de sauvegarde (pas du jeu). À incrémenter quand la forme de l'état change,
  // en ajoutant la migration correspondante ci-dessous.
  const FORMAT = 2;

  // MIGRATIONS[n] transforme des données au format n en données au format n + 1.
  const MIGRATIONS = {
    // 0.2 : apparition du territoire.
    1: (data) => ({ ...data, territory: { lit: false, area: 0 } }),
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
    for (const up of Vide.UPGRADES) {
      const level = upgrades[up.id];
      if (!Number.isInteger(level) || level <= 0) continue;
      state.upgrades[up.id] = up.max === null ? level : Math.min(level, up.max);
    }

    const player = isObject(raw.player) ? raw.player : {};
    state.player.x = finite(player.x, 0);
    state.player.y = finite(player.y, 0);

    const territory = isObject(raw.territory) ? raw.territory : {};
    state.territory.lit = territory.lit === true;
    if (state.territory.lit) {
      const start = Math.PI * Vide.CONFIG.territory.startRadius ** 2;
      state.territory.area = Math.max(positive(territory.area, start), start);
    }

    const stats = isObject(raw.stats) ? raw.stats : {};
    state.stats.playTime = positive(stats.playTime, 0);
    state.stats.collected = Math.floor(positive(stats.collected, 0));

    return state;
  }

  Vide.Save = { FORMAT, serialize, deserialize, sanitize };
})(globalThis.Vide);
