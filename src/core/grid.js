// Grille spatiale : retrouve vite les objets proches d'un point (êtres, ombres…), au lieu de tous les parcourir.
// On la remplit à chaque pas, puis on l'interroge autant qu'on veut.
(function (Vide) {
  'use strict';

  const SPAN = 2097152; // clé numérique d'une case : i * SPAN + j

  function create(cell) {
    return { cell, cells: new Map() };
  }

  function clear(grid) {
    for (const list of grid.cells.values()) list.length = 0;
  }

  function insert(grid, obj) {
    const k = Math.floor(obj.x / grid.cell) * SPAN + Math.floor(obj.y / grid.cell);
    let list = grid.cells.get(k);
    if (!list) grid.cells.set(k, (list = []));
    list.push(obj);
  }

  // Appelle fn(obj) pour chaque objet des cases qui touchent le disque (x, y, radius).
  // (Les objets un peu plus loin que le rayon peuvent aussi être proposés : à l'appelant de mesurer.)
  function near(grid, x, y, radius, fn) {
    const c = grid.cell;
    const i0 = Math.floor((x - radius) / c), i1 = Math.floor((x + radius) / c);
    const j0 = Math.floor((y - radius) / c), j1 = Math.floor((y + radius) / c);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = grid.cells.get(i * SPAN + j);
        if (list) for (let k = 0; k < list.length; k++) fn(list[k]);
      }
    }
  }

  Vide.Grid = { create, clear, insert, near };
})(globalThis.Vide);
