// Champ de particules : le vide est infini, on ne garde donc que les particules proches du joueur.
// Elles naissent (en fondu) dans un disque autour de lui et s'effacent quand il s'éloigne.
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  function create(seed) {
    return {
      particles: [],
      rng: util.rng(seed ^ 0x9e3779b9),
      budget: 0, // particules « dues » par le reremplissage, accumulées entre les pas
    };
  }

  function targetCount(stats) {
    const f = CONFIG.field;
    const n = Math.round(f.density * Math.PI * f.radius * f.radius * stats.density);
    return Math.min(f.maxParticles, n);
  }

  function place(field, x, y, rare, visible) {
    const f = CONFIG.field;
    const r = field.rng;
    const p = {
      x, y,
      vx: r.range(-1, 1) * f.drift,
      vy: r.range(-1, 1) * f.drift,
      rare,
      value: rare ? f.rareValue : 1,
      age: visible ? f.fadeIn : 0,
      caught: -1,               // temps écoulé depuis la capture, -1 si libre
      phase: r() * Math.PI * 2, // décalage du scintillement
    };
    field.particles.push(p);
    return p;
  }

  // Tirage uniforme dans le disque autour de (cx, cy), hors du rayon d'attraction.
  function spawn(field, cx, cy, stats, visible) {
    const f = CONFIG.field;
    const r = field.rng;
    const minDist = stats.reach + f.spawnGap;
    for (let tries = 0; tries < 10; tries++) {
      const angle = r() * Math.PI * 2;
      const dist = f.radius * Math.sqrt(r());
      if (dist < minDist) continue;
      const rare = r() < f.rareChance;
      return place(field, cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, rare, visible);
    }
    return null;
  }

  // Remplit instantanément le champ (au démarrage), sans fondu.
  function fill(field, cx, cy, stats) {
    const target = targetCount(stats);
    for (let guard = 0; field.particles.length < target && guard < target * 4; guard++) {
      spawn(field, cx, cy, stats, true);
    }
  }

  function removeAt(list, i) {
    list[i] = list[list.length - 1];
    list.pop();
  }

  // Fait vivre une liste de particules autour de la lumière du joueur : dérive, capture dans la portée,
  // poursuite, récolte, et effacement au-delà de despawnRadius (Infinity : jamais).
  // Une particule retirée de la liste est marquée `gone` (utile à qui la visait, comme une lueur).
  // Renvoie la lumière brute récoltée (avant multiplicateur) et le nombre de particules.
  function attract(list, player, stats, dt, despawnRadius) {
    const a = CONFIG.attraction;
    const reach2 = stats.reach * stats.reach;
    const collect2 = a.collectRadius * a.collectRadius;
    const despawn2 = despawnRadius * despawnRadius;
    let value = 0;
    let count = 0;

    // Parcours à l'envers : une suppression par échange avec le dernier ne saute aucune particule.
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const d2 = dx * dx + dy * dy;

      if (d2 <= collect2) {
        value += p.value;
        count++;
        p.gone = true;
        removeAt(list, i);
        continue;
      }
      if (p.caught < 0 && d2 > despawn2) {
        p.gone = true;
        removeAt(list, i);
        continue;
      }
      if (p.caught < 0 && d2 < reach2) p.caught = 0;

      if (p.caught >= 0) {
        // Une particule attrapée accélère jusqu'à rattraper la lumière, même si le joueur fuit.
        p.caught += dt;
        const d = Math.sqrt(d2);
        const move = Math.min((a.pullSpeed + a.pullAccel * p.caught) * dt, d);
        p.x += (dx / d) * move;
        p.y += (dy / d) * move;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    return { value, count };
  }

  // Avance le champ d'un pas. Renvoie la lumière brute récoltée (avant multiplicateur) et le nombre de particules.
  function update(field, player, stats, dt) {
    const f = CONFIG.field;
    const list = field.particles;
    const result = attract(list, player, stats, dt, f.despawnRadius);

    // Reremplissage progressif : le vide se recharge, mais pas instantanément.
    const target = targetCount(stats);
    if (list.length < target) {
      field.budget = Math.min(field.budget + (target / f.refillTime) * dt, 5);
      while (field.budget >= 1 && list.length < target) {
        field.budget--;
        spawn(field, player.x, player.y, stats, false);
      }
    } else {
      field.budget = 0;
    }
    return result;
  }

  // Attrape d'un coup toutes les particules libres d'une liste dans un rayon (utilisé par la pulsation).
  function catchList(list, x, y, radius) {
    const r2 = radius * radius;
    let caught = 0;
    for (const p of list) {
      if (p.caught >= 0) continue;
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy <= r2) {
        p.caught = 0;
        caught++;
      }
    }
    return caught;
  }

  function catchWithin(field, x, y, radius) {
    return catchList(field.particles, x, y, radius);
  }

  Vide.Field = { create, targetCount, place, spawn, fill, attract, update, catchList, catchWithin, removeAt };
})(globalThis.Vide);
