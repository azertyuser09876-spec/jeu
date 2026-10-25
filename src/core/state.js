// État persistant de la partie : tout ce qui est sauvegardé, et rien d'autre.
// Ce qui se recalcule (particules, vitesse, caméra…) vit dans l'objet « game » de sim.js.
(function (Vide) {
  'use strict';

  function create(seed) {
    return {
      seed: seed >>> 0,
      light: 0,          // lumière disponible
      totalLight: 0,     // lumière récoltée depuis le début
      upgrades: {},      // niveau de chaque amélioration, par identifiant
      player: { x: 0, y: 0 },
      villages: [],      // villages fondés : territoire, êtres, bâtiments (voir villages.js)
      roads: [],         // routes entre villages : { a, b, work } (voir roads.js)
      expeditions: [],   // expéditions en route (voir expeditions.js)
      beacon: null,      // fanal posé : { x, y, light } (voir abilities.js)
      nests: [],         // bases (nids) d'ombre : { id, x, y, hp, age, region, area, cells, buildings, walls, build } (voir nests.js)
      cleared: [],       // régions libérées d'un nid, pour de bon
      war: null,         // la guerre, une fois ouverte : { age } (voir war.js)
      faction: null,     // sous-faction choisie par le joueur pour son premier village (voir factions.js)
      nestTimer: null,   // secondes avant le prochain nid près de tes villages
      echoes: 0,         // échos laissés par les ombres vaincues
      tides: 0,          // marées d'ombres déjà venues (leur taille en dépend)
      army: { posture: 'garde' }, // ordre donné à l'armée : garde, escorte, chasse
      lore: [],          // fragments du récit déjà révélés, dans l'ordre
      cinematics: [],    // tableaux (cinématiques) déjà vus : 'ouverture', 'rencontre:veilleur'…
      memories: 0,       // souvenirs (✧) gagnés en renaissant
      legacy: {},        // améliorations héritées (achetées en souvenirs) : elles survivent aux renaissances
      renaissances: 0,   // nombre de renaissances
      runStart: 0,       // lumière totale au moment de la dernière renaissance
      colossi: {},       // colosses : 'heard' (entendu), 'found' (rencontré), 'tamed' (apaisé), 'corrupted' (pris par les ombres)
      corruption: {},    // ce que les ombres ont rongé de chaque colosse apaisé (0 à 1, voir corruption.js)
      studied: {},       // sceaux dévoilés par les érudits, par colosse
      engines: [],       // engins de siège : balistes et chaînes (voir engines.js)
      zones: {
        visited: [],     // régions visitées (clés "i,j"), pour la carte
        discovered: [],  // types de zones déjà rencontrés
      },
      stats: {
        playTime: 0,     // secondes de jeu actif
        collected: 0,    // particules récoltées
        shadows: 0,      // ombres vaincues
      },
    };
  }

  Vide.State = { create };
})(globalThis.Vide);
