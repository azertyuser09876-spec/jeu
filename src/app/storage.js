// Lien entre le format de sauvegarde (src/core/save.js) et le stockage du navigateur.
// Le stockage peut être indisponible (navigation privée, stockage plein…) : le jeu continue alors sans sauvegarde.
(function (Vide) {
  'use strict';

  const KEY = 'le-vide/save';
  const BACKUP_KEY = 'le-vide/save-illisible';

  const storage = {
    // Passe à vrai si la sauvegarde existante vient d'une version plus récente : on ne l'écrase jamais.
    readOnly: false,
    lastSave: null,
  };

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Renvoie le résultat de Vide.Save.deserialize, ou null s'il n'y a pas de sauvegarde.
  function load() {
    const text = read(KEY);
    if (!text) return null;
    const result = Vide.Save.deserialize(text);
    if (result.ok) {
      storage.lastSave = result.savedAt;
    } else {
      console.warn(`Sauvegarde non chargée (${result.reason}).`);
      if (result.reason === 'newer') {
        storage.readOnly = true;
      } else {
        // On met de côté la sauvegarde illisible au lieu de la perdre.
        write(BACKUP_KEY, text);
      }
    }
    return result;
  }

  function save(state) {
    if (storage.readOnly) return false;
    const now = Date.now();
    const ok = write(KEY, Vide.Save.serialize(state, now));
    if (ok) storage.lastSave = now;
    return ok;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* rien à effacer */ }
    storage.readOnly = false;
    storage.lastSave = null;
  }

  // Remplace la partie enregistrée (import d'un code). Elle reprend « maintenant » : pas d'absence offerte.
  function replace(state) {
    storage.readOnly = false;
    return save(state);
  }

  storage.load = load;
  storage.replace = replace;
  storage.save = save;
  storage.clear = clear;
  Vide.Storage = storage;
})(globalThis.Vide);
