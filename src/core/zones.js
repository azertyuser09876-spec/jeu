// Les zones : le vide infini se découpe en régions (cellules de Voronoï irrégulières, stables pour une graine).
// Le type d'une région dépend surtout de sa distance au foyer : plus on s'éloigne, plus c'est riche et dangereux.
(function (Vide) {
  'use strict';
  const { util } = Vide;

  // Catalogue des zones.
  //   density   multiplicateur du nombre de particules        rare     multiplicateur des particules rares
  //   shadows   fréquence des ombres errantes (0 : aucune)     echoes   multiplicateur des échos gagnés
  //   current   force du courant qui entraîne la lumière       fog      brouillard (0 à 1) qui réduit la vue
  //   kinds     poids des ombres errantes de la zone          tint     teinte de la lumière et de la poussière
  Vide.ZONES = [
    { id: 'calme', name: 'Le Calme', desc: 'Le vide paisible autour du foyer.',
      density: 1, rare: 1, shadows: 0, echoes: 1, current: 0, fog: 0,
      kinds: { errante: 1 }, tint: [214, 234, 255] },
    { id: 'brume', name: 'La Brume', desc: 'Une lumière abondante, noyée dans un brouillard épais.',
      density: 1.8, rare: 1.2, shadows: 0.6, echoes: 1, current: 0, fog: 0.8,
      kinds: { errante: 3, rodeuse: 1 }, tint: [196, 214, 232] },
    { id: 'courants', name: 'Les Courants', desc: 'Un flot invisible emporte tout ce qui flotte.',
      density: 1.3, rare: 1.6, shadows: 0.8, echoes: 1.2, current: 75, fog: 0,
      kinds: { errante: 2, rodeuse: 2 }, tint: [160, 232, 255] },
    { id: 'murmure', name: 'Le Murmure', desc: 'Les ombres y chuchotent, nombreuses. La lumière rare aussi.',
      density: 0.85, rare: 3, shadows: 1.7, echoes: 1.5, current: 0, fog: 0.3,
      kinds: { errante: 2, rodeuse: 3, massive: 1 }, tint: [204, 184, 255] },
    { id: 'eclat', name: 'L’Éclat', desc: 'Des éclats dorés partout… et ce qui les garde.',
      density: 1.2, rare: 6, shadows: 2.2, echoes: 2, current: 30, fog: 0,
      kinds: { errante: 1, rodeuse: 2, massive: 2 }, tint: [255, 222, 160] },
    { id: 'gouffre', name: 'Le Gouffre', desc: 'Le fond du vide. Presque rien n’y brille, et rien n’y est sûr.',
      density: 0.5, rare: 10, shadows: 3, echoes: 3, current: 0, fog: 0.6,
      kinds: { rodeuse: 2, massive: 3 }, tint: [150, 140, 225] },
  ];

  const CELL = 2400; // taille moyenne d'une région

  // Types possibles selon la distance du centre de la région au foyer.
  const BANDS = [
    { until: 3200, ids: ['calme'] },
    { until: 7000, ids: ['brume', 'courants', 'murmure', 'calme'] },
    { until: 12000, ids: ['courants', 'murmure', 'eclat', 'brume'] },
    { until: Infinity, ids: ['eclat', 'gouffre', 'murmure', 'gouffre'] },
  ];

  function get(id) {
    const z = Vide.ZONES.find((zone) => zone.id === id);
    if (!z) throw new Error(`Zone inconnue : ${id}`);
    return z;
  }

  // Centre (irrégulier mais stable) de la cellule (i, j).
  function center(i, j, seed) {
    return {
      x: (i + 0.15 + 0.7 * util.hash2(i, j, seed + 31)) * CELL,
      y: (j + 0.15 + 0.7 * util.hash2(i, j, seed + 37)) * CELL,
    };
  }

  function typeOf(i, j, seed) {
    const c = center(i, j, seed);
    const d = Math.hypot(c.x, c.y);
    const band = BANDS.find((b) => d < b.until);
    return band.ids[Math.floor(util.hash2(i, j, seed + 41) * band.ids.length)];
  }

  // Région qui contient le point (x, y) : { zone, i, j, key, edge, current: { x, y } }.
  // edge : distance approximative à la frontière la plus proche (pour adoucir les transitions).
  function at(seed, x, y) {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    let best = null, bestD = Infinity, secondD = Infinity;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = ci + di, j = cj + dj;
        const c = center(i, j, seed);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bestD) {
          secondD = bestD;
          bestD = d;
          best = { i, j };
        } else if (d < secondD) {
          secondD = d;
        }
      }
    }
    const zone = get(typeOf(best.i, best.j, seed));
    const angle = util.hash2(best.i, best.j, seed + 43) * Math.PI * 2;
    return {
      zone,
      i: best.i,
      j: best.j,
      key: `${best.i},${best.j}`,
      edge: (secondD - bestD) / 2,
      current: { x: Math.cos(angle) * zone.current, y: Math.sin(angle) * zone.current },
    };
  }

  // Note la région visitée ; renvoie vrai si c'est un type de zone jamais vu.
  function visit(state, region) {
    const z = state.zones;
    if (!z.visited.includes(region.key)) {
      z.visited.push(region.key);
      if (z.visited.length > MAX_VISITED) z.visited.shift();
    }
    if (z.discovered.includes(region.zone.id)) return false;
    z.discovered.push(region.zone.id);
    return true;
  }

  const MAX_VISITED = 5000;

  Vide.Zones = { CELL, MAX_VISITED, get, center, typeOf, at, visit };
})(globalThis.Vide);
