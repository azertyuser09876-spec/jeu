// Les gouverneurs : chaque village (et chaque base d'ombre) a le sien, avec un budget. Le même cerveau pour les deux
// camps : on lui présente ce qu'il pourrait faire — chaque action avec son prix et son envie —, il choisit la plus
// voulue. S'il ne peut pas se l'offrir, il économise pour elle, en ne s'accordant que de petites dépenses à côté.
// Son ambition (0 à 1) grandit avec le temps, et nourrit l'envie de s'agrandir et de conquérir.
// Les actions de chaque camp sont ailleurs : steward.js (villages), nests.js (bases).
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // Une décision, parmi `actions` = [{ id, cost, want, act() }], avec `funds` en poche :
  // { action, done } (done : il peut l'acheter maintenant), ou null s'il ne veut rien.
  function decide(actions, funds) {
    const list = actions.filter((a) => a.want > 0).sort((a, b) => b.want - a.want);
    if (!list.length) return null;
    const best = list[0];
    if (best.cost <= funds) return { action: best, done: true };
    // Il économise pour elle ; une petite dépense, presque aussi voulue, passe quand même.
    const pocket = list.find((a) => a !== best && a.cost <= funds && a.cost <= best.cost * CONFIG.governors.pocket
      && a.want >= best.want * CONFIG.governors.pocketWant);
    return pocket ? { action: pocket, done: true, saving: best } : { action: best, done: false };
  }

  // Ambition : de 0 à 1, au fil de `seconds` (temps de jeu pour un village, âge pour une base).
  function ambition(seconds) {
    return util.clamp(seconds / CONFIG.governors.ambitionTime, 0, 1);
  }

  Vide.Governors = { decide, ambition };
})(globalThis.Vide);
