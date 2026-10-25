// La guerre : elle s'ouvre avec le premier avant-poste des ombres (voir nests.js). Douce d'abord — la tension :
// des ombres rôdent autour de tes villages sans attaquer —, puis de plus en plus rude : les avant-postes lancent
// leurs raids, les bases bâtissent, essaiment et frappent plus souvent, et plus fort. Elle mûrit aussi pendant
// l'absence.
// État persistant : state.war = null (pas encore), ou { age } (secondes depuis son ouverture).
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // Ouvre la guerre ; renvoie vrai si elle vient de s'ouvrir.
  function begin(state) {
    if (state.war) return false;
    state.war = { age: 0 };
    return true;
  }

  function advance(state, seconds) {
    if (state.war) state.war.age += seconds;
  }

  // Âpreté : de 0 (pas de guerre, ou elle s'ouvre) à 1 (au plus rude).
  function intensity(state) {
    return state.war ? util.clamp(state.war.age / CONFIG.war.ramp, 0, 1) : 0;
  }

  // La tension du début : les avant-postes ne font que rôder.
  function calm(state) {
    return Boolean(state.war) && intensity(state) < CONFIG.war.calm;
  }

  // Le nom de ce moment de la guerre (null sans guerre).
  function phase(state) {
    if (!state.war) return null;
    const i = intensity(state);
    return i < CONFIG.war.calm ? 'tension' : i < 0.6 ? 'âpre' : 'rude';
  }

  // Rythme des ombres (raids, constructions, essaimage) : ×1 sans guerre, jusqu'à ×(1 + pace) au plus rude.
  function pace(state) {
    return 1 + CONFIG.war.pace * intensity(state);
  }

  // Taille des raids : un peu moindre au début de la guerre, bien plus grande au plus rude.
  function raidScale(state) {
    return state.war ? CONFIG.war.raidFrom + (CONFIG.war.raidTo - CONFIG.war.raidFrom) * intensity(state) : 1;
  }

  // La réponse des ombres à un village : plus son armée est grande, plus ce qu'elles lancent contre lui est grand
  // (raids, renforts, campagnes, poussée sur les fronts, défenseurs d'une base qu'il assiège). La lumière qui croît
  // sans fin trouve toujours la noirceur à sa mesure.
  function answer(state, v) {
    return v ? 1 + Vide.Colony.usedIn(v, 'armyCap') / CONFIG.war.answerArmy : 1;
  }

  Vide.War = { begin, advance, intensity, calm, phase, pace, raidScale, answer };
})(globalThis.Vide);
