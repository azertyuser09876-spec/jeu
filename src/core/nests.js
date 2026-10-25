// Les ombres bâtissent : des bases d'ombre (des « nids »), bâties comme tes villages mais en négatif. Un cœur noir,
// un territoire de noirceur (les mêmes cellules que tes territoires, en cinq nuances de noir) qui grandit avec
// l'âge sans jamais empiéter sur tes villages ; sur leur plan radial, des ouvrages (fosses, flèches : voir
// ouvrages.js) et, mûres, des remparts d'ombre. Elles naissent après tes premiers villages (à distance de ton
// village le plus proche), ou t'attendent déjà dans les régions dangereuses lointaines. Elles lancent des raids
// sur tes villages ; ton armée peut les assiéger (ouvrages, remparts, puis le cœur). Mûres, elles essaiment des
// avant-postes vers tes villages : le premier ouvre la guerre (voir war.js). Chaque base a son gouverneur (le même
// cerveau que tes villages, voir governors.js) : il dépense sa noirceur en ouvrages, remparts, bêtes, avant-postes
// et assauts.
// État persistant : state.nests = [{ id, x, y, hp, age, region, area, cells, buildings: [{ type, x, y, hp }],
// walls, funds, parent, swarm, faction, creatures }] (funds : la noirceur de son gouverneur ; parent : la base
// d'où vient un avant-poste, null pour une base ; swarm : secondes avant qu'elle puisse essaimer) ;
// state.cleared : régions libérées pour de bon ;
// state.nestTimer : secondes avant la prochaine base près de tes villages (null tant qu'il n'y en a pas lieu).
(function (Vide) {
  'use strict';
  const { CONFIG, util, Territory, Villages, Zones } = Vide;

  // Le noir gagne ses nuances comme le blanc (voir territory.js), à son rythme.
  const DARKENING = { whitening: 1 };

  const FAR_ZONES = ['murmure', 'eclat', 'gouffre'];

  function level(nest) {
    const n = CONFIG.nests;
    return Math.min(nest.parent ? n.outpostMaxLevel : n.maxLevel, 1 + Math.floor(nest.age / n.levelEvery));
  }

  function maxHp(nest) {
    const n = CONFIG.nests;
    return n.hp + n.hpPerLevel * (level(nest) - 1);
  }

  // Rayon de sa noirceur (un avant-poste est plus petit).
  function radius(nest) {
    const n = CONFIG.nests;
    return (n.radius + n.radiusPerLevel * (level(nest) - 1)) * (nest.parent ? n.outpostSize : 1);
  }

  function create(game) {
    game.nests = {
      raids: new Map(), defend: new Map(), lastWave: new Map(), rng: util.rng(game.state.seed ^ 0x6e657374),
      towerCd: new Map(),   // recharge de chaque flèche
      think: new Map(),     // horloge du gouverneur de chaque base
      relief: new Map(),    // horloge des renforts de chaque base (pour une voisine assiégée)
      campaigns: new Map(), // horloge des campagnes de chaque base
    };
  }

  // La base dont la noirceur couvre (x, y), ou null.
  function darkAt(state, x, y) {
    for (const nest of state.nests) if (Territory.contains(nest, x, y)) return nest;
    return null;
  }

  // Les territoires où une base ne s'étend pas : tes villages, et les autres bases.
  function others(state, nest) {
    return [...state.villages, ...state.nests.filter((o) => o !== nest)];
  }

  // Surface visée selon le niveau ; la base grandit vers elle (sans empiéter), et sa noirceur mûrit.
  function spread(state, nest, seconds) {
    nest.area = Math.max(nest.area, Math.PI * radius(nest) ** 2);
    Territory.grow(nest, others(state, nest));
    DARKENING.whitening = CONFIG.nests.darkening;
    Territory.whiten(nest, DARKENING, seconds);
  }

  // Remet les champs d'une base (une base, comme un village, se reconnaît à `dark`).
  function shape(nest) {
    nest.dark = true;
    nest.type = 'ombre';
    nest.districts = [];
    return nest;
  }

  function add(state, x, y, age, regionKey) {
    const nest = shape({
      id: state.nests.reduce((m, n) => Math.max(m, n.id), 0) + 1,
      x, y, hp: 0, age: age || 0, region: regionKey || null,
      area: 0, cells: [], buildings: [], walls: [], funds: 0,
      parent: null, swarm: CONFIG.nests.outpostEvery, faction: null, creatures: {},
    });
    nest.faction = Vide.Factions.inherit(state, null, Vide.DARK_FACTIONS, nest.id);
    nest.hp = maxHp(nest);
    state.nests.push(nest);
    spread(state, nest, 0);
    // Une base déjà mûre (lointaine) a déjà bâti.
    while (fortify(state, nest)) { /* tout ce que son âge permet */ }
    for (const w of nest.walls) w.work = Vide.Walls.workOf(w);
    return nest;
  }

  // --- Ouvrages ---

  // Nombre d'ouvrages de ce type qu'une base de ce niveau peut avoir.
  function allowed(nest, d) {
    const l = level(nest);
    return l < d.from ? 0 : Math.min(d.max, 1 + Math.floor((l - d.from) / d.every));
  }

  const countOf = (nest, type) => nest.buildings.filter((b) => b.type === type).length;

  // Remparts d'ombre qu'une base de ce niveau peut avoir.
  function wallsAllowed(nest) {
    const l = level(nest);
    return CONFIG.nests.wallLevels.filter((x) => l >= x).length;
  }

  // Une base née mûre a déjà bâti ce que son âge permet (sans compter) : un ouvrage, ou un rempart, ou une bête de
  // sa garnison à chaque appel. Renvoie ce qu'elle a commencé, ou null.
  function fortify(state, nest) {
    for (const d of Vide.DARK_WORKS) {
      if (countOf(nest, d.id) >= allowed(nest, d)) continue;
      const at = Vide.Plan.choose(nest, d);
      if (!at) continue;
      const work = { type: d.id, x: at.x, y: at.y, hp: d.hp };
      nest.buildings.push(work);
      return work;
    }
    if (nest.walls.length < wallsAllowed(nest) && !Vide.Walls.site(nest)) return Vide.Walls.plan(nest);
    // Sa garnison de bêtes.
    const beast = Vide.Creatures.reinforce(nest);
    return beast ? { type: beast } : null;
  }

  // Ce que rapportent ses fosses : ombres de plus par raid, défenseurs de plus.
  function bonus(nest, key) {
    let n = 0;
    for (const b of nest.buildings) n += Vide.darkWork(b.type)[key] || 0;
    return n;
  }

  // Un nid près de tes villages : à bonne distance du plus proche, et loin de tous les autres villages.
  function spawnNear(state, rng) {
    const n = CONFIG.nests;
    const base = state.villages[Math.floor(rng() * state.villages.length)];
    for (let tries = 0; tries < 24; tries++) {
      const a = rng() * Math.PI * 2;
      const d = n.spawnDistance[0] + rng() * (n.spawnDistance[1] - n.spawnDistance[0]);
      const x = base.x + Math.cos(a) * d, y = base.y + Math.sin(a) * d;
      const clear = state.villages.every((v) => Math.hypot(v.x - x, v.y - y) - Territory.radius(v) > n.spawnDistance[0] * 0.7);
      const apart = state.nests.every((o) => Math.hypot(o.x - x, o.y - y) > 1500);
      if (clear && apart) return add(state, x, y, 0, null);
    }
    return null;
  }

  // Loin de l'origine, une région dangereuse peut abriter un nid déjà mûr : on le découvre en approchant.
  function discover(state, region) {
    const n = CONFIG.nests;
    if (!FAR_ZONES.includes(region.zone.id) || state.cleared.includes(region.key)) return null;
    if (state.nests.some((x) => x.region === region.key) || state.nests.length >= n.max * 2) return null;
    if (util.hash2(region.i, region.j, state.seed + 5309) > n.farChance) return null;
    const c = Zones.center(region.i, region.j, state.seed);
    if (Math.hypot(c.x, c.y) < n.farFrom) return null;
    return add(state, c.x, c.y, n.levelEvery * 3, region.key);
  }

  // --- Avant-postes ---

  // Une base mûre essaime : un avant-poste sur le chemin de ton village le plus proche, à bonne distance de tes
  // villages et des autres bases. Renvoie l'avant-poste, ou null s'il n'y a pas la place.
  function spawnOutpost(state, base) {
    const n = CONFIG.nests;
    const target = Villages.nearest(state, base.x, base.y);
    if (!target) return null;
    const dist = Math.hypot(target.x - base.x, target.y - base.y);
    if (dist > n.outpostRange) return null;
    const toward = Math.atan2(target.y - base.y, target.x - base.x);
    const d = util.clamp(dist * 0.45, n.outpostDistance[0], n.outpostDistance[1]);
    for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
      const x = base.x + Math.cos(toward + off) * d, y = base.y + Math.sin(toward + off) * d;
      const clear = state.villages.every((v) => Math.hypot(v.x - x, v.y - y) - Territory.radius(v) > n.outpostGap);
      const apart = state.nests.every((o) => Math.hypot(o.x - x, o.y - y) - Territory.radius(o) > n.outpostGap * 0.7);
      if (!clear || !apart) continue;
      const outpost = add(state, x, y, 0, null);
      outpost.parent = base.id;
      outpost.faction = Vide.Factions.inherit(state, base.faction, Vide.DARK_FACTIONS, outpost.id);
      outpost.swarm = 0;
      return outpost;
    }
    return null;
  }

  const outposts = (state, base) => state.nests.filter((o) => o.parent === base.id).length;

  // Seules les bases nées près de tes villages essaiment (celles des régions lointaines restent chez elles), une
  // fois mûres.
  const swarms = (base) => !base.parent && !base.region && level(base) >= CONFIG.nests.outpostLevel;

  // L'horloge d'essaimage d'une base. Renvoie vrai quand elle peut essaimer (son gouverneur décide s'il le fait).
  function swarm(state, base, seconds) {
    if (!swarms(base)) return false;
    base.swarm = Math.max(0, base.swarm - seconds * Vide.War.pace(state));
    return base.swarm === 0;
  }

  // Pendant la tension, un avant-poste n'envoie que des rôdeuses : elles tournent autour de ton village, sans
  // attaquer, puis s'en vont.
  function prowl(game, nest, target) {
    const rng = game.nests.rng;
    let count = 0;
    for (let k = 0; k < CONFIG.war.prowlers && game.shadows.list.length < CONFIG.shadows.max; k++) {
      const s = Vide.Shadows.spawn(game, 'rodeuse', nest.x + (rng() - 0.5) * 80, nest.y + (rng() - 0.5) * 80, 'tide');
      s.home = target;
      s.calm = true;
      s.ttl = CONFIG.war.prowlTime;
      count++;
    }
    Vide.Sim.emit(game, 'prowl', { x: nest.x, y: nest.y, village: target.type, count });
    return count;
  }

  // Lance un raid depuis une base vers le village le plus proche (s'il est à portée), ou vers `to` ; `scale` : son
  // ampleur (×1 par défaut) ; `kind` : 'relief' (des renforts pour une base assiégée), 'campaign' (une campagne des
  // ombres), sinon un raid ordinaire. Renvoie le nombre d'ombres.
  function raid(game, nest, to, scale, kind) {
    const { state } = game;
    const n = CONFIG.nests;
    const target = to || Villages.nearest(state, nest.x, nest.y);
    if (!target || Math.hypot(target.x - nest.x, target.y - nest.y) > n.raidRange) return 0;
    if (nest.parent && Vide.War.calm(state)) return prowl(game, nest, target);
    const rng = game.nests.rng;
    const kinds = Vide.SHADOW_KINDS.filter((k) => level(nest) >= k.fromTide / 2 + 1);
    let budget = (n.raidBase + n.raidPerLevel * level(nest) + bonus(nest, 'raid')) * Vide.War.raidScale(state) * (scale || 1);
    let count = 0;
    while (budget >= 1 && game.shadows.list.length < CONFIG.shadows.max) {
      const affordable = kinds.filter((k) => k.cost <= budget);
      const k = affordable[Math.floor(rng() * affordable.length)];
      budget -= k.cost;
      const s = Vide.Shadows.spawn(game, k.id, nest.x + (rng() - 0.5) * 80, nest.y + (rng() - 0.5) * 80, 'tide');
      s.home = target;
      s.faction = nest.faction;
      count++;
    }
    // Une base mûre lâche aussi ses bêtes.
    count += Vide.Creatures.raid(game, nest, target);
    Vide.Sim.emit(game, 'raid', { x: nest.x, y: nest.y, village: target.type, count, kind: kind || null });
    return count;
  }

  // --- Les ombres font front ensemble ---

  // Le village le plus faible (la moindre défense : voir Absence.defense) à portée de raid d'une base, ou null.
  function weakest(state, nest) {
    let best = null, bestD = Infinity;
    for (const v of state.villages) {
      if (Math.hypot(v.x - nest.x, v.y - nest.y) > CONFIG.nests.raidRange) continue;
      const d = Vide.Absence.defense(v);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  // Une base assiégée par une campagne appelle ses voisines : chacune, à son rythme et à ses frais, frappe le
  // village qui l'assiège (son armée est au loin).
  function relief(game, dt) {
    const { state } = game;
    const n = CONFIG.nests;
    const g = game.nests;
    for (const besieged of state.nests) {
      const foes = state.villages.filter((v) => v.campaign === besieged.id);
      if (!foes.length) continue;
      for (const helper of state.nests) {
        if (helper === besieged || Math.hypot(helper.x - besieged.x, helper.y - besieged.y) > n.reliefRange) continue;
        const clock = (g.relief.has(helper.id) ? g.relief.get(helper.id) : n.reliefEvery * 0.5) - dt;
        g.relief.set(helper.id, clock);
        if (clock > 0) continue;
        g.relief.set(helper.id, n.reliefEvery / Vide.War.pace(state));
        const cost = raidCost(state, helper) * n.reliefScale;
        if (helper.funds < cost) continue;
        const target = foes[0];
        if (raid(game, helper, target, n.reliefScale, 'relief')) helper.funds -= cost;
      }
    }
  }

  function update(game, dt) {
    const { state } = game;
    const n = CONFIG.nests;
    const g = game.nests;

    // Un nid près de tes villages après le deuxième, puis un autre de temps en temps.
    let founded = 0;
    for (const v of state.villages) founded += 1 + (v.districts ? v.districts.length : 0);
    if (state.nestTimer === null && founded >= n.firstAfter) state.nestTimer = n.firstDelay;
    if (state.nestTimer !== null && state.villages.length) {
      state.nestTimer -= dt;
      if (state.nestTimer <= 0) {
        state.nestTimer = n.every;
        if (state.nests.filter((x) => !x.region).length < n.max) {
          const nest = spawnNear(state, g.rng);
          if (nest) Vide.Sim.emit(game, 'nest', { x: nest.x, y: nest.y, first: state.nests.length === 1 });
        }
      }
    }
    if (game.region) {
      const nest = discover(state, game.region);
      if (nest) Vide.Sim.emit(game, 'nest', { x: nest.x, y: nest.y, far: true, first: state.nests.length === 1 });
    }

    Vide.War.advance(state, dt);
    for (const nest of state.nests.slice()) {
      nest.age += dt;
      nest.hp = Math.min(maxHp(nest), nest.hp + n.regen * dt);
      spread(state, nest, dt);
      earn(state, nest, dt);
      swarm(state, nest, dt);
      // Ses remparts montent d'eux-mêmes.
      const wall = Vide.Walls.site(nest);
      if (wall) Vide.Walls.addWork(wall, n.wallWork * dt);
      shoot(game, nest, dt);
      // L'horloge de ses assauts (son gouverneur les lance quand elle sonne, s'il en a les moyens).
      g.raids.set(nest.id, (g.raids.has(nest.id) ? g.raids.get(nest.id) : n.raidEvery * (0.5 + g.rng() * 0.5)) - dt);
      // Son gouverneur réfléchit toutes les deux secondes (chaque base à son moment : le calcul se répartit).
      const think = (g.think.has(nest.id) ? g.think.get(nest.id) : n.think * g.rng()) - dt;
      g.think.set(nest.id, think > 0 ? think : n.think);
      if (think > 0) continue;
      for (let k = 0; k < 3; k++) {
        const done = govern(state, nest, game);
        if (!done) break;
        tell(game, nest, done);
      }
    }

    relief(game, dt);

    // L'obscurité épuise la lumière, hors de tes territoires.
    const { player } = state;
    if (darkAt(state, player.x, player.y) && !Territory.isInside(state, player.x, player.y)) {
      const v = game.vitality;
      if (v.invulnerable <= 0) {
        v.hp -= n.drain * dt;
        v.lastHurt = game.time;
        if (v.hp <= 0) Vide.Combat.disperse(game);
      }
    }
  }

  // --- Son gouverneur ---
  // Le même cerveau que celui de tes villages (governors.js). Son budget : la noirceur, qui rentre d'autant plus vite
  // que la base est mûre (et que la guerre est âpre). Il la dépense en ouvrages, remparts, bêtes de sa garnison,
  // avant-postes et assauts, d'après leurs stats invisibles (`worth`) et les besoins de la base : la menace, son
  // ambition (qui grandit avec son âge), sa sous-faction (`lean`, voir factions.js).

  // Les stats invisibles de ses gestes propres (celles des ouvrages et des bêtes sont dans leurs catalogues).
  const WORTH = { rempart: { guard: 2 }, outpost: { reach: 1 }, raid: { raid: 1 }, campaign: { raid: 3.5 } };

  // Noirceur gagnée par seconde ; ce qu'elle en garde au plus.
  const income = (state, nest) => CONFIG.nests.income * level(nest) * Vide.War.pace(state);
  const hold = (nest) => CONFIG.nests.income * level(nest) * CONFIG.nests.fundsHold;

  function earn(state, nest, seconds) {
    nest.funds = Math.min(hold(nest), nest.funds + income(state, nest) * seconds);
  }

  // La menace sur une base (0 à 1) : son cœur ou ses ouvrages blessés, une campagne lancée contre elle.
  function threat(state, nest) {
    let t = 0;
    const max = maxHp(nest);
    if (nest.hp < max - 1) t = 0.6 + 0.4 * (1 - nest.hp / max);
    if (nest.buildings.some((b) => b.hp < Vide.darkWork(b.type).hp)) t = Math.max(t, 0.6);
    if (state.villages.some((v) => v.campaign === nest.id)) t = Math.max(t, 0.8);
    return Math.min(1, t);
  }

  // Le prix d'un assaut : le poids de ses ombres (avant ce que la guerre y ajoute, voir War.raidScale).
  function raidCost(state, nest) {
    const n = CONFIG.nests;
    if (nest.parent && Vide.War.calm(state)) return n.price.prowl;
    return (n.raidBase + n.raidPerLevel * level(nest) + bonus(nest, 'raid')) * n.price.raid;
  }

  // Les besoins de la base : ce que vaut, par seconde, un point de chaque stat invisible. Menacée, elle veut se
  // défendre ; ambitieuse, attaquer et s'étendre.
  function needs(state, nest) {
    const power = income(state, nest);
    const t = threat(state, nest);
    const ambition = Vide.Governors.ambition(nest.age);
    return {
      guard: power * (0.3 + 2 * t),
      raid: power * (0.6 + ambition) * (1 - 0.7 * t),
      reach: power * ambition * 1.5,
    };
  }

  // Ce que son gouverneur pourrait faire : [{ kind, id, cost, want, act }] (act renvoie ce qui est fait, ou null).
  // Sans `game` (pendant l'absence), pas d'assaut.
  function actions(state, nest, game) {
    const n = CONFIG.nests;
    const P = n.price;
    const need = needs(state, nest);
    const lean = (Vide.Factions.def(nest.faction) || {}).lean || {};
    const list = [];
    const offer = (kind, id, cost, worth, act) => {
      const want = Vide.Governors.want(Vide.Governors.gain(worth, need), cost) * (1 + (lean[kind] || 0));
      list.push({ kind, id, cost, want, act });
    };
    // Ouvrages : des fosses (des assauts plus gros), des flèches (plus voulues quand on l'attaque).
    for (const d of Vide.DARK_WORKS) {
      if (countOf(nest, d.id) >= allowed(nest, d)) continue;
      const at = Vide.Plan.choose(nest, d);
      if (!at) continue;
      offer('work', d.id, P[d.id], d.worth, () => {
        const work = { type: d.id, x: at.x, y: at.y, hp: d.hp };
        nest.buildings.push(work);
        return work;
      });
    }
    if (nest.walls.length < wallsAllowed(nest) && !Vide.Walls.site(nest)) {
      offer('wall', 'rempart', P.rempart, WORTH.rempart, () => Vide.Walls.plan(nest));
    }
    // Une bête de plus dans sa garnison.
    const want = Vide.Creatures.garrison(nest);
    const beast = Object.keys(want).find((id) => ((nest.creatures || {})[id] || 0) < want[id]);
    if (beast) offer('beast', beast, P[beast], Vide.Creatures.kind(beast).worth, () => (Vide.Creatures.reinforce(nest) ? { type: beast } : null));
    // Un avant-poste vers tes villages (le premier ouvre la guerre).
    if (swarms(nest) && nest.swarm === 0 && outposts(state, nest) < n.outpostsPer && state.nests.length < n.max * 3) {
      offer('outpost', 'avant-poste', P.outpost, WORTH.outpost, () => {
        const outpost = spawnOutpost(state, nest);
        nest.swarm = outpost ? n.outpostEvery : n.outpostEvery / 4; // pas de place : elle réessaiera plus tard
        return outpost;
      });
    }
    // Un assaut, quand son horloge sonne et qu'un de tes villages est à portée (moins voulu quand on l'attaque).
    if (game && game.nests.raids.get(nest.id) <= 0) {
      const target = Villages.nearest(state, nest.x, nest.y);
      if (target && Math.hypot(target.x - nest.x, target.y - nest.y) <= n.raidRange) {
        offer('raid', 'assaut', raidCost(state, nest), WORTH.raid, () => {
          const g = game.nests;
          g.raids.set(nest.id, (n.raidEvery + (g.rng() - 0.5) * 2 * n.raidJitter) / Vide.War.pace(state));
          const count = raid(game, nest);
          return count ? { type: 'raid', count } : null;
        });
      }
    }
    // Mûre, en guerre rude, une campagne : une vague triple contre ton village le plus faible à sa portée.
    if (game && Vide.War.phase(state) === 'rude' && level(nest) >= n.campaignLevel && !(game.nests.campaigns.get(nest.id) > game.time)) {
      const target = weakest(state, nest);
      if (target) {
        offer('raid', 'campagne', raidCost(state, nest) * n.campaignScale, WORTH.campaign, () => {
          game.nests.campaigns.set(nest.id, game.time + n.campaignEvery / Vide.War.pace(state));
          const count = raid(game, nest, target, n.campaignScale, 'campaign');
          return count ? { type: 'campaign', count } : null;
        });
      }
    }
    return list;
  }

  // Ce qu'il vise (ou vient de faire) : { kind, id }, ou null.
  const intents = new WeakMap();
  const intent = (nest) => intents.get(nest) || null;

  // Son gouverneur choisit, et agit s'il en a les moyens. Renvoie ce qu'il a fait ({ kind, id, done }), ou null.
  function govern(state, nest, game) {
    const choice = Vide.Governors.decide(actions(state, nest, game), nest.funds);
    if (!choice) {
      intents.delete(nest);
      return null;
    }
    const a = choice.saving || choice.action;
    intents.set(nest, { kind: a.kind, id: a.id });
    if (!choice.done) return null;
    const done = choice.action.act();
    if (!done) return null;
    nest.funds -= choice.action.cost;
    return { kind: choice.action.kind, id: choice.action.id, done };
  }

  // Ce qu'il a fait, dit à la simulation (un assaut s'annonce de lui-même).
  function tell(game, nest, d) {
    const { state } = game;
    if (d.kind === 'outpost') {
      Vide.Sim.emit(game, 'outpost', { x: d.done.x, y: d.done.y, first: !state.war });
      if (Vide.War.begin(state)) Vide.Sim.emit(game, 'war', { x: d.done.x, y: d.done.y });
    } else if (d.kind !== 'raid') {
      Vide.Sim.emit(game, 'nestBuilt', { x: nest.x, y: nest.y, kind: d.kind === 'wall' ? 'rempart' : d.done.type });
    }
  }

  // Les flèches tirent sur la lumière à leur portée : toi d'abord, puis tes êtres, puis tes expéditions.
  function shoot(game, nest, dt) {
    const { state } = game;
    const g = game.nests;
    for (const b of nest.buildings) {
      const d = Vide.darkWork(b.type);
      if (!d.tower) continue;
      const cd = (g.towerCd.get(b) || 0) - dt;
      if (cd > 0) {
        g.towerCd.set(b, cd);
        continue;
      }
      const { range, damage } = d.tower;
      let target = null;
      const p = state.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) <= range) target = { x: p.x, y: p.y, hit: () => Vide.Combat.hurtPlayer(game, damage, b.x, b.y) };
      if (!target && game.colony.grid) {
        let best = null, bestD = range;
        Vide.Grid.near(game.colony.grid, b.x, b.y, range, (o) => {
          const dd = Math.hypot(o.x - b.x, o.y - b.y);
          if (dd <= bestD && Vide.Colony.isActive(o)) {
            bestD = dd;
            best = o;
          }
        });
        if (best) target = { x: best.x, y: best.y, hit: () => Vide.Combat.hurtBeing(game, best, damage) };
      }
      if (!target) {
        const e = state.expeditions.find((x) => Math.hypot(x.x - b.x, x.y - b.y) <= range);
        if (e) target = { x: e.x, y: e.y, hit: () => Vide.Expeditions.hurt(state, e, damage) };
      }
      if (!target) {
        g.towerCd.set(b, 0.3); // personne à portée : elle regarde de nouveau un peu plus tard
        continue;
      }
      g.towerCd.set(b, d.tower.cooldown);
      target.hit();
      Vide.Sim.emit(game, 'darkBolt', { x: b.x, y: b.y, tx: target.x, ty: target.y });
    }
  }

  // --- Siège ---

  // Un ouvrage, vu comme une cible (objet stable).
  const workTargets = new WeakMap();
  function workTarget(nest, b) {
    let t = workTargets.get(b);
    if (!t) {
      t = { nest, work: b, radius: Vide.darkWork(b.type).size, x: b.x, y: b.y };
      workTargets.set(b, t);
    }
    t.hp = b.hp;
    return t;
  }

  // L'ouvrage le plus proche de (x, y) (les flèches d'abord), ou null.
  function nearestWork(nest, x, y) {
    let best = null, bestScore = Infinity;
    for (const b of nest.buildings) {
      const score = Math.hypot(b.x - x, b.y - y) + (Vide.darkWork(b.type).tower ? 0 : 400);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  // Frappe un ouvrage ; renvoie vrai s'il s'effondre.
  function hitWork(game, nest, b, amount) {
    if (!nest.buildings.includes(b)) return false;
    b.hp -= amount;
    if (b.hp > 0) return false;
    nest.buildings.splice(nest.buildings.indexOf(b), 1);
    const echoes = CONFIG.nests.workEchoes * game.stats.echoGain;
    game.state.echoes += echoes;
    Vide.Sim.emit(game, 'workDown', { x: b.x, y: b.y, kind: b.type, echoes });
    return true;
  }

  // Le cœur d'un nid, vu comme une cible (objet stable : l'armée peut le viser plusieurs fois).
  const targets = new WeakMap();
  function target(nest) {
    let t = targets.get(nest);
    if (!t) {
      t = { nest, radius: 28, x: nest.x, y: nest.y };
      targets.set(nest, t);
    }
    t.hp = nest.hp;
    return t;
  }

  // Le nid le plus proche de (x, y), à portée de siège, ou null.
  function nearest(state, x, y, range) {
    let best = null;
    let bestD = range === undefined ? Infinity : range;
    for (const nest of state.nests) {
      const d = Math.hypot(nest.x - x, nest.y - y);
      if (d < bestD) {
        bestD = d;
        best = nest;
      }
    }
    return best;
  }

  // Frappe le cœur d'un nid. Attaqué, il fait jaillir des défenseurs ; détruit, il rend beaucoup d'échos et sa
  // région est libérée pour de bon. Renvoie vrai s'il vient d'être détruit.
  function hit(game, nest, amount) {
    const { state } = game;
    const n = CONFIG.nests;
    if (!state.nests.includes(nest)) return false;
    nest.hp -= amount;
    const last = game.nests.defend.get(nest.id);
    if (last === undefined || game.time - last >= n.defendEvery) {
      game.nests.defend.set(nest.id, game.time);
      const rng = game.nests.rng;
      for (let k = 0; k < n.defenders + level(nest) + bonus(nest, 'defenders'); k++) {
        const a = rng() * Math.PI * 2;
        Vide.Shadows.spawn(game, k % 3 ? 'errante' : 'rodeuse', nest.x + Math.cos(a) * 40, nest.y + Math.sin(a) * 40, 'roam');
      }
    }
    if (nest.hp > 0) return false;
    const echoes = (n.echoes + n.echoesPerLevel * (level(nest) - 1)) * game.stats.echoGain;
    state.echoes += echoes;
    const key = nest.region || Zones.at(state.seed, nest.x, nest.y).key;
    if (!state.cleared.includes(key)) state.cleared.push(key);
    const taken = fall(state, nest);
    Vide.Sim.emit(game, 'nestDestroyed', {
      x: nest.x, y: nest.y, echoes, first: state.cleared.length === 1,
      village: taken ? taken.village.type : null, cells: taken ? taken.cells : 0,
    });
    return true;
  }

  // Le village dont le territoire touche celui de la base, ou null.
  function neighbor(state, nest) {
    const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const v of state.villages) {
      for (let k = 0; k < nest.cells.length; k += 3) {
        const i = nest.cells[k], j = nest.cells[k + 1];
        for (const [di, dj] of N) if (Territory.has(v, i + di, j + dj)) return v;
      }
    }
    return null;
  }

  // Une base tombe : ses ouvrages et ses remparts s'effondrent ; son terrain retourne au vide, ou rejoint ton
  // village s'il le touche (une lumière neuve, qui devra blanchir). Les ombres répondent : si elle était née près de
  // tes villages, une autre s'y lève bientôt, ailleurs. Renvoie { village, cells } ou null.
  function fall(state, nest) {
    state.nests.splice(state.nests.indexOf(nest), 1);
    if (!nest.region && !nest.parent && state.nestTimer !== null) state.nestTimer = Math.min(state.nestTimer, CONFIG.nests.answer);
    const heir = neighbor(state, nest);
    if (!heir) return null;
    let cells = 0;
    for (let k = 0; k < nest.cells.length; k += 3) {
      const i = nest.cells[k], j = nest.cells[k + 1];
      if (Territory.has(heir, i, j) || Territory.owned(state.nests, i, j)) continue;
      heir.cells.push(i, j, 0);
      cells++;
    }
    heir.area += cells * Territory.CELL * Territory.CELL;
    return { village: heir, cells };
  }

  // Pendant l'absence : elles vieillissent, grandissent, noircissent ; leurs gouverneurs bâtissent et essaiment
  // (sans assaut) ; la guerre mûrit, ou s'ouvre. Le temps passe par tranches (un avant-poste né en route vit le reste de l'absence).
  // Renvoie { outposts, war } : avant-postes nés, guerre ouverte pendant l'absence.
  function offline(state, seconds) {
    const n = CONFIG.nests;
    const report = { outposts: 0, war: false };
    const lived = new Map(state.nests.map((x) => [x, 0]));
    const STEP = n.outpostEvery / 2;
    for (let left = seconds; left > 1e-9; left -= STEP) {
      const dt = Math.min(STEP, left);
      Vide.War.advance(state, dt);
      for (const nest of state.nests.slice()) {
        nest.age += dt;
        lived.set(nest, lived.get(nest) + dt);
        spread(state, nest, 0);
        earn(state, nest, dt);
        swarm(state, nest, dt);
        for (let k = 0; k < 20; k++) {
          const done = govern(state, nest, null);
          if (!done) break;
          if (done.kind !== 'outpost') continue;
          report.outposts++;
          if (Vide.War.begin(state)) report.war = true;
        }
        const wall = Vide.Walls.site(nest);
        if (wall) Vide.Walls.addWork(wall, n.wallWork * dt);
      }
      for (const nest of state.nests) if (!lived.has(nest)) lived.set(nest, 0);
    }
    // Leur noirceur a mûri le temps qu'elles ont vécu.
    for (const nest of state.nests) spread(state, nest, lived.get(nest) || 0);
    return report;
  }

  Vide.Nests = {
    FAR_ZONES, level, maxHp, radius, create, darkAt, others, spread, shape, add, allowed, wallsAllowed, fortify, bonus,
    spawnNear, discover, spawnOutpost, swarm, prowl, raid, weakest, relief, update, income, hold, earn, threat, raidCost, WORTH, needs, actions, intent,
    govern, shoot, offline, neighbor, fall, target, workTarget, nearestWork, hitWork, nearest, hit,
  };
})(globalThis.Vide);
