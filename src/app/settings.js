// Réglages du joueur (son, zoom, secousses…), gardés dans le navigateur à part de la sauvegarde de partie.
(function (Vide) {
  'use strict';

  const KEY = 'le-vide/reglages';
  let values = {};

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && typeof v === 'object') values = v;
    } catch (e) { /* réglages par défaut */ }
  }

  function get(name, fallback) {
    return name in values ? values[name] : fallback;
  }

  function set(name, value) {
    values[name] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch (e) { /* tant pis : le réglage vaut pour cette session */ }
  }

  load();
  Vide.Settings = { get, set };
})(globalThis.Vide);
