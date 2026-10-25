// Les gouverneurs : chaque village (et chaque base d'ombre) a le sien, avec un budget. Le même cerveau pour les deux
// camps : on lui présente ce qu'il pourrait faire — chaque action avec son prix et son envie —, il choisit la plus
// voulue. S'il ne peut pas se l'offrir, il économise pour elle, en ne s'accordant que de petites dépenses à côté.
// Son ambition (0 à 1) grandit avec le temps, et nourrit l'envie de s'agrandir et de conquérir.
// Les actions de chaque camp sont ailleurs : steward.js (villages), nests.js (bases).
//
// Les stats invisibles : chaque chose qu'un gouverneur peut faire porte, dans ses données, ce qu'elle rapporte
// (`worth`, jamais affiché) :
//   yield   part de production en plus (0,2 : +20 %)      growth  part de croissance du territoire en plus
//   room    places pour des êtres                          army    places pour des soldats
//   guard   défense (une tour ≈ 1)                         care    soins
//   away    heures d'absence                               build   part de vitesse des chantiers en plus
//   white   part de vitesse du blanc en plus               raid    force d'assaut (ombres)
//   reach   expansion (colonies, avant-postes)
// Le gouverneur les pèse selon les besoins de son village ou de sa base (`needs` : ce que vaut, par seconde, un point
// de chaque stat, estimé sur son état réel) : gain = Σ worth × needs. Son envie : la part de son prix qu'un geste
// rend sur son horizon.
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

  // Ce que rapporte par seconde une chose de stats invisibles `worth`, pour ces besoins.
  function gain(worth, needs) {
    let g = 0;
    for (const k in worth || {}) g += worth[k] * (needs[k] || 0);
    return g;
  }

  // L'envie d'un geste qui rapporte `g` par seconde pour ce prix : la part du prix rendue sur l'horizon.
  function want(g, cost) {
    return g > 0 ? (g * CONFIG.governors.horizon) / Math.max(cost, 1) : 0;
  }

  Vide.Governors = { decide, ambition, gain, want };
})(globalThis.Vide);
