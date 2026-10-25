// Les colosses disputés : en guerre ouverte, les bases d'ombre mûres rongent les colosses apaisés à leur portée
// (state.corruption[id], de 0 à 1) ; on le voit, il s'assombrit. Ta pulsation, quand elle le touche, le purifie en
// partie. Rongé jusqu'au bout, il est corrompu (state.colossi[id] = 'corrupted') : il perd son rôle et son bienfait,
// redevient hostile — teinté des ombres — et marche aussitôt sur ton village le plus proche. On le reprend comme on
// l'a apaisé : sceau après sceau (Colossus.tame annonce alors qu'il est repris).
(function (Vide) {
  'use strict';
  const { CONFIG } = Vide;

  // Ce que les ombres rongent par seconde d'un colosse apaisé qui se tient en (x, y) : chaque base mûre à portée,
  // selon l'intensité de la guerre (rien sans guerre ouverte).
  function rate(state, x, y) {
    if (!state.war || Vide.War.calm(state)) return 0;
    const M = CONFIG.colossi;
    let bases = 0;
    for (const n of state.nests) {
      if (Vide.Nests.level(n) >= M.corruptLevel && Math.hypot(n.x - x, n.y - y) <= M.corruptRange) bases++;
    }
    return (bases * Vide.War.intensity(state)) / M.corruptTime;
  }

  // Un colosse apaisé passe aux ombres.
  function corrupt(game, c) {
    const { state } = game;
    state.colossi[c.id] = 'corrupted';
    delete state.corruption[c.id];
    c.calm = 0;
    c.corrupt = 1;
    c.attack = null;
    c.stagger = 0;
    c.kneel = 0;
    c.active = 0;
    for (const s of c.seals) s.hp = s.max;
    c.mode = 'roam';
    Vide.Sim.emit(game, 'colossusCorrupted', { id: c.id });
    // Il marche aussitôt sur ton village le plus proche.
    const v = Vide.Villages.nearest(state, c.x, c.y);
    if (v) {
      c.mode = 'march';
      c.march = { village: v.id, stay: CONFIG.colossi.marchStay, arrived: false };
      c.wander = null;
      Vide.Sim.emit(game, 'march', { id: c.id, village: v.type, x: v.x, y: v.y, corrupted: true });
    }
  }

  // Pendant le jeu : les ombres rongent ; ta pulsation purifie (une fois par pulsation, si son onde l'atteint).
  function update(game, dt) {
    const { state } = game;
    const { player } = state;
    const p = game.pulse;
    for (const c of game.colossi) {
      if (Vide.Colossus.status(state, c.id) !== 'tamed') continue;
      let g = state.corruption[c.id] || 0;
      if (p.wave >= 0 && c.purified !== p.id && Math.hypot(c.core.x - player.x, c.core.y - player.y) <= p.wave + Vide.Colossus.extent(c) * 0.5) {
        c.purified = p.id;
        if (g > 0) {
          g = Math.max(0, g - CONFIG.colossi.purify);
          Vide.Sim.emit(game, 'purified', { id: c.id, left: g });
        }
      }
      const before = g;
      g += rate(state, c.x, c.y) * dt;
      if (before < CONFIG.colossi.corruptWarn && g >= CONFIG.colossi.corruptWarn) Vide.Sim.emit(game, 'corrupting', { id: c.id });
      if (g >= 1) {
        corrupt(game, c);
        continue;
      }
      if (g > 0) state.corruption[c.id] = g;
      else delete state.corruption[c.id];
      c.corrupt = g;
    }
  }

  Vide.Corruption = { rate, corrupt, update };
})(globalThis.Vide);
