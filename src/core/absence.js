// La guerre pendant ton absence — tout peut arriver. Une fois la guerre ouverte, elle se joue en abstrait, tour
// après tour (CONFIG.absence.turn secondes), avec les règles du jeu là où on le peut :
//   - les fronts (Fronts.step) : des cellules se prennent et se perdent, la noirceur rampe ;
//   - les assauts : chaque base, à son rythme et si elle peut les payer, frappe le village le plus proche — le poids
//     de ses ombres contre la défense du village (soldats, tours, enceintes). Repoussé : des échos ; sinon, des
//     bâtiments s'éteignent (les bâtisseurs les relèveront au retour) ;
//   - les campagnes : l'armée d'un village assiège sa base (ouvrages, puis cœur) ; la base tombe, ou l'armée s'use
//     et rentre ;
//   - les colosses apaisés se font ronger, jusqu'à tomber aux ombres (voir corruption.js).
// Pendant la tension (ou sans guerre), rien de tout cela : les bases ne font que mûrir (Nests.offline).
(function (Vide) {
  'use strict';
  const { CONFIG, util } = Vide;

  // La défense d'un village contre un assaut.
  function defense(v) {
    const A = CONFIG.absence;
    const S = Vide.Structures;
    let walls = 0;
    for (const w of v.walls || []) if (Vide.Walls.isDone(w) && !w.broken.length) walls++;
    return Vide.Colony.usedIn(v, 'armyCap') * A.perSoldier
      + (S.working(v, 'tour') + 2 * S.working(v, 'citadelle')) * A.perTower + walls * A.perWall;
  }

  // Le poids d'un assaut de cette base (comme en jeu : voir Nests.raid).
  function weight(state, nest) {
    const n = CONFIG.nests;
    return (n.raidBase + n.raidPerLevel * Vide.Nests.level(nest) + Vide.Nests.bonus(nest, 'raid')) * Vide.War.raidScale(state);
  }

  // Un assaut pendant l'absence. Renvoie { village, repelled, echoes, broken: [types] } ou null.
  function assault(state, nest, rng, stats) {
    const A = CONFIG.absence;
    // (Mûre, en guerre rude, elle mène campagne contre le village le plus faible, comme en jeu.)
    const campaign = Vide.War.phase(state) === 'rude' && Vide.Nests.level(nest) >= CONFIG.nests.campaignLevel;
    const target = campaign ? Vide.Nests.weakest(state, nest) : Vide.Villages.nearest(state, nest.x, nest.y);
    if (!target || Math.hypot(target.x - nest.x, target.y - nest.y) > CONFIG.nests.raidRange) return null;
    const cost = Vide.Nests.raidCost(state, nest);
    if (nest.funds < cost) return null;
    nest.funds -= cost;
    const S = weight(state, nest), D = defense(target);
    if (D >= S) {
      const echoes = S * A.echoPerWeight * stats.echoGain;
      state.echoes += echoes;
      return { village: target, repelled: true, echoes, broken: [] };
    }
    // Ce qui passe éteint des bâtiments (au plus quelques-uns).
    const broken = [];
    const standing = target.buildings.filter((b) => Vide.Structures.isWorking(b));
    let left = Math.min(A.maxBroken, Math.ceil((S - D) / A.breakEvery));
    while (left-- > 0 && standing.length) {
      const b = standing.splice(Math.floor(rng() * standing.length), 1)[0];
      b.broken = true;
      broken.push(b.type);
    }
    return { village: target, repelled: false, echoes: 0, broken };
  }

  // Un tour de siège : l'armée d'un village use les ouvrages de sa base, puis son cœur ; elle perd des soldats
  // (`wear` : l'usure accumulée, par village). Renvoie 'won' (la base est tombée), 'retreat' (l'armée rentre) ou null.
  function siege(state, v, nest, seconds, stats, wear) {
    const A = CONFIG.absence;
    const army = Vide.Colony.usedIn(v, 'armyCap');
    let damage = army * A.siegeDps * stats.armyDamage * seconds;
    for (const b of nest.buildings.slice()) {
      if (damage <= 0) break;
      const dealt = Math.min(b.hp, damage);
      b.hp -= dealt;
      damage -= dealt;
      if (b.hp <= 0) {
        nest.buildings.splice(nest.buildings.indexOf(b), 1);
        state.echoes += CONFIG.nests.workEchoes * stats.echoGain;
      }
    }
    nest.hp = Math.min(Vide.Nests.maxHp(nest), nest.hp + CONFIG.nests.regen * seconds) - Math.max(0, damage);
    // Ses défenseurs usent l'armée (les gardiens d'abord, puis les autres soldats).
    let worn = (wear.get(v) || 0) + Vide.Nests.level(nest) * A.siegeLoss * seconds;
    for (; worn >= 1; worn--) {
      const sp = Vide.SPECIES.find((x) => x.cap === 'armyCap' && (v.beings[x.id] || 0) > 0);
      if (!sp) break;
      v.beings[sp.id]--;
    }
    wear.set(v, worn);
    if (nest.hp <= 0) {
      const echoes = (CONFIG.nests.echoes + CONFIG.nests.echoesPerLevel * (Vide.Nests.level(nest) - 1)) * stats.echoGain;
      state.echoes += echoes;
      const key = nest.region || Vide.Zones.at(state.seed, nest.x, nest.y).key;
      if (!state.cleared.includes(key)) state.cleared.push(key);
      Vide.Nests.fall(state, nest);
      return 'won';
    }
    return Vide.Colony.usedIn(v, 'armyCap') < CONFIG.governors.campaignRetreat ? 'retreat' : null;
  }

  // Applique `seconds` d'absence à la guerre. Renvoie le résumé :
  // { taken: { light, shadow }, lost: [types], raids: { repelled, broken }, echoes, broken: [types],
  //   fallen: [types de villages vainqueurs], retreats: [types], corrupted: [ids] }.
  function war(state, seconds) {
    const A = CONFIG.absence;
    const report = {
      taken: { light: 0, shadow: 0 }, lost: [], raids: { repelled: 0, broken: 0 }, echoes: 0, broken: [],
      fallen: [], retreats: [], corrupted: [],
    };
    if (!state.war || seconds <= 0) return report;
    const stats = Vide.Stats.compute(state);
    const rng = util.rng((state.seed ^ 0x77617273) + Math.floor(state.totalLight % 1e9));
    const echoes0 = state.echoes;
    const clocks = new Map();
    const wear = new Map();
    let fronts = 0;
    // (La guerre a déjà mûri de toute l'absence, voir Nests.offline : on la rejoue à l'âge qu'elle avait à chaque tour ;
    // ouverte pendant l'absence, rien avant.)
    const age = state.war.age;
    for (let t = 0; t < seconds; t += A.turn) {
      const dt = Math.min(A.turn, seconds - t);
      state.war.age = age - (seconds - t - dt);
      if (state.war.age < 0 || Vide.War.calm(state)) continue;
      // Les fronts (au plus `frontSteps` tours sur toute l'absence).
      for (let k = 0; k < Math.round(dt / CONFIG.fronts.every) && fronts < A.frontSteps; k++, fronts++) {
        for (const r of Vide.Fronts.step(state, rng)) {
          report.taken[r.side]++;
          if (r.fallen && r.side === 'shadow') report.lost.push(r.fallen.type);
          if (r.fallen && r.side === 'light') state.echoes += CONFIG.nests.workEchoes * stats.echoGain;
        }
      }
      // Les assauts.
      for (const nest of state.nests.slice()) {
        if (nest.parent && Vide.War.calm(state)) continue;
        const clock = (clocks.has(nest.id) ? clocks.get(nest.id) : CONFIG.nests.raidEvery * (0.5 + rng() * 0.5)) - dt;
        if (clock > 0) {
          clocks.set(nest.id, clock);
          continue;
        }
        clocks.set(nest.id, CONFIG.nests.raidEvery / Vide.War.pace(state));
        const r = assault(state, nest, rng, stats);
        if (!r) continue;
        if (r.repelled) report.raids.repelled++;
        else report.raids.broken++;
        report.broken.push(...r.broken);
      }
      // Les campagnes.
      for (const v of state.villages) {
        const nest = v.campaign && state.nests.find((n) => n.id === v.campaign);
        if (!v.campaign) continue;
        const end = nest ? siege(state, v, nest, dt, stats, wear) : 'won';
        if (end === 'won') report.fallen.push(v.type);
        if (end === 'retreat') report.retreats.push(v.type);
        if (end) v.campaign = null;
      }
      // Les colosses apaisés.
      for (const d of Vide.COLOSSI) {
        if (Vide.Colossus.status(state, d.id) !== 'tamed') continue;
        const at = Vide.Colossus.home(state, d);
        const g = (state.corruption[d.id] || 0) + Vide.Corruption.rate(state, at.x, at.y) * dt;
        if (g >= 1) {
          state.colossi[d.id] = 'corrupted';
          delete state.corruption[d.id];
          report.corrupted.push(d.id);
        } else if (g > 0) {
          state.corruption[d.id] = g;
        }
      }
    }
    state.war.age = age;
    report.echoes = state.echoes - echoes0;
    return report;
  }

  Vide.Absence = { defense, weight, assault, siege, war };
})(globalThis.Vide);
