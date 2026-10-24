// Combat : vitalité de la lumière, coups des ombres, projectiles, tours, comportements de l'armée.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Colony, Structures, Shadows, Territory, Villages } = Vide;

  const POSTURES = ['garde', 'escorte', 'chasse', 'siege'];

  function create(game) {
    game.vitality = {
      hp: game.stats.vitality,
      hurt: 0,          // éclat bref après une blessure (affichage)
      lastHurt: -99,
      invulnerable: 0,  // secondes restantes d'invulnérabilité
    };
    game.projectiles = [];
    game.towerCd = new Map();
    game.heartHurt = new Map(); // cœurs de village rongés par les ombres (affichage)
    game.lastHeartAlert = -99;
  }

  // --- Coups des ombres ---

  function hurtPlayer(game, amount, fromX, fromY) {
    const v = game.vitality;
    if (v.invulnerable > 0) return;
    v.hp -= amount;
    v.hurt = 1;
    v.lastHurt = game.time;
    // Le coup repousse la lumière.
    const p = game.state.player;
    const dx = p.x - fromX, dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    game.velocity.x += (dx / d) * CONFIG.combat.knockback;
    game.velocity.y += (dy / d) * CONFIG.combat.knockback;
    if (v.hp <= 0) disperse(game);
  }

  // Lumière vaincue : elle se disperse et renaît au cœur du village le plus proche (à l'origine s'il n'y en a
  // aucun), en perdant une part de sa lumière.
  function disperse(game) {
    const { state } = game;
    const lost = state.light * CONFIG.combat.dispersalLoss;
    state.light -= lost;
    const from = { x: state.player.x, y: state.player.y };
    const home = Villages.nearest(state, from.x, from.y);
    state.player.x = home ? home.x : 0;
    state.player.y = home ? home.y : 0;
    game.velocity.x = game.velocity.y = 0;
    game.vitality.hp = game.stats.vitality;
    game.vitality.invulnerable = CONFIG.combat.invulnerable;
    game.field.particles.length = 0;
    Vide.Field.fill(game.field, state.player.x, state.player.y, game.stats);
    Vide.Sim.emit(game, 'dispersed', { lost, from, to: { x: state.player.x, y: state.player.y }, village: home ? home.type : null });
  }

  function hurtBeing(game, b, amount) {
    if (!Colony.isActive(b)) return;
    b.hp -= amount;
    b.lastHurt = game.time;
    b.hurt = 1;
    if (b.hp > 0) return;
    // Vaincu : il s'éteint, lâche ce qu'il portait, et se rallumera au cœur de son village plus tard.
    b.hp = 0;
    b.down = CONFIG.colony.downTime;
    if (b.target && b.target.claimedBy === b.id) b.target.claimedBy = 0;
    b.target = null;
    b.carry = 0;
    b.carryValue = 0;
    b.dance = null;
    b.task = 'idle';
    Vide.Sim.emit(game, 'beingDown', { species: b.species, x: b.x, y: b.y });
  }

  function strike(game, shadow, target, amount) {
    switch (target.type) {
      case 'player':
        hurtPlayer(game, amount, shadow.x, shadow.y);
        break;
      case 'being':
        hurtBeing(game, target.ref, amount);
        break;
      case 'building': {
        game.colony.flashes.set(target.ref, -1); // éclat négatif : le bâtiment vacille
        // Les remparts d'un bastion amortissent les coups.
        const armor = target.village ? Villages.statsOf(game, target.village).structureArmor : 1;
        if (Structures.damage(game, target.ref, amount / armor)) {
          Vide.Sim.emit(game, 'broken', { building: target.ref.type });
        }
        break;
      }
      case 'expedition':
        if (Vide.Expeditions.hurt(game.state, target.ref, amount)) {
          Vide.Sim.emit(game, 'expeditionLost', { kind: target.ref.kind });
        }
        break;
      case 'heart': {
        // Les ombres au cœur d'un village dévorent la réserve de lumière.
        const { state } = game;
        state.light = Math.max(0, state.light - amount * CONFIG.combat.foyerDrain);
        game.heartHurt.set(target.ref, 1);
        if (game.time - game.lastHeartAlert > 15) {
          game.lastHeartAlert = game.time;
          Vide.Sim.emit(game, 'heartAttacked', { village: target.ref.type });
        }
        break;
      }
    }
  }

  // --- Vitalité ---

  function updateVitality(game, dt) {
    const v = game.vitality;
    const max = game.stats.vitality;
    v.invulnerable = Math.max(0, v.invulnerable - dt);
    v.hurt = Math.max(0, v.hurt - dt * 2);
    if (game.time - v.lastHurt > CONFIG.combat.regenDelay) {
      const { player } = game.state;
      const home = Villages.at(game.state, player.x, player.y);
      const boost = home ? CONFIG.combat.insideRegen * Villages.statsOf(game, home).regen : 1;
      v.hp += CONFIG.combat.regen * boost * dt;
    }
    v.hp = Math.min(v.hp, max);
  }

  // --- Pulsation : l'onde blesse chaque ombre une seule fois ---

  function pulseHit(game, x, y, radius) {
    const id = game.pulse.id;
    const r2 = radius * radius;
    for (const s of game.shadows.list) {
      if (s.lastWave === id || s.hp <= 0) continue;
      if ((s.x - x) ** 2 + (s.y - y) ** 2 > r2) continue;
      s.lastWave = id;
      Shadows.damage(s, game.stats.pulseDamage);
    }
    // Les sceaux des colosses aussi ; et le cœur des nids (deux fois plus), une fois par onde.
    if (Vide.Colossus) Vide.Colossus.pulseHit(game, x, y, radius);
    for (const nest of game.state.nests.slice()) {
      if (game.nests.lastWave.get(nest.id) === id || Math.hypot(nest.x - x, nest.y - y) > radius + 28) continue;
      game.nests.lastWave.set(nest.id, id);
      Vide.Nests.hit(game, nest, game.stats.pulseDamage * 2);
    }
  }

  // --- Projectiles (traits des étincelles et des tours), légèrement guidés ---

  // `siege` : multiplicateur déjà compris dans `damage` (harpon lancé sur un colosse ou un nid) ; une ombre
  // prise en chemin n'en subit pas l'effet.
  function fire(game, x, y, target, damage, source, siege) {
    const dx = target.x - x, dy = target.y - y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = CONFIG.combat.projectileSpeed;
    game.projectiles.push({
      x, y, vx: (dx / d) * speed, vy: (dy / d) * speed,
      target, damage, source, siege: siege || 1, life: CONFIG.combat.projectileLife,
    });
  }

  function updateProjectiles(game, dt) {
    const list = game.projectiles;
    const speed = CONFIG.combat.projectileSpeed;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (p.target && p.target.hp > 0) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = util.damp(8, dt);
        p.vx += ((dx / d) * speed - p.vx) * k;
        p.vy += ((dy / d) * speed - p.vy) * k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      // Un trait lancé sur un colosse le frappe dès qu'il atteint son corps.
      // Un trait lancé sur le cœur d'un nid le frappe en l'atteignant.
      if (p.target && p.target.nest) {
        if (Math.hypot(p.target.x - p.x, p.target.y - p.y) <= p.target.radius) {
          Vide.Nests.hit(game, p.target.nest, p.damage);
          list.splice(i, 1);
          continue;
        }
      }
      if (p.target && p.target.colossus) {
        if (Math.hypot(p.target.x - p.x, p.target.y - p.y) <= p.target.radius * 0.7) {
          Vide.Colossus.hit(game, p.target.colossus, p.damage);
          list.splice(i, 1);
          continue;
        }
      }
      const hit = Shadows.nearest(game, p.x, p.y, CONFIG.combat.projectileHit + 10);
      if (hit && Math.hypot(hit.x - p.x, hit.y - p.y) <= CONFIG.combat.projectileHit + Shadows.kind(hit.kind).radius) {
        Shadows.damage(hit, p.damage / p.siege);
        list.splice(i, 1);
        continue;
      }
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  // --- Tours de lumière ---

  function updateTowers(game, dt) {
    for (const v of game.state.villages) {
      const stats = Villages.statsOf(game, v);
      for (const b of v.buildings) updateTower(game, b, stats, dt);
    }
  }

  function updateTower(game, b, stats, dt) {
    const d = Structures.def(b.type);
    if (!d.tower || !Structures.isWorking(b)) return;
    const cd = (game.towerCd.get(b) || 0) - dt;
    if (cd > 0) {
      game.towerCd.set(b, cd);
      return;
    }
    const target = Shadows.nearest(game, b.x, b.y, d.tower.range);
    if (target) {
      fire(game, b.x, b.y, target, d.tower.damage * stats.armyDamage, 'tower');
      game.towerCd.set(b, d.tower.cooldown);
    } else {
      game.towerCd.set(b, 0);
    }
  }

  // --- Armée ---

  function setPosture(state, posture) {
    if (!POSTURES.includes(posture)) return false;
    state.army.posture = posture;
    return true;
  }

  // Zone qu'un être de l'armée défend selon l'ordre donné : centre et rayon d'engagement.
  // En garde ou en chasse, chacun défend son propre village.
  function anchor(game, b) {
    const { state } = game;
    const v = b.village;
    const R = Territory.radius(v);
    switch (state.army.posture) {
      case 'escorte': return { x: state.player.x, y: state.player.y, radius: 320 };
      case 'chasse': return { x: v.x, y: v.y, radius: R + 1400 };
      case 'siege': {
        // Contre un colosse en combat à portée de son village, sinon au nid le plus proche (sans rien à
        // portée : il garde son village).
        const c = Vide.Engines.foe(game, v.x, v.y, CONFIG.nests.siegeRange);
        if (c) return { x: c.core.x, y: c.core.y, radius: c.core.radius + 400 };
        const nest = Vide.Nests.nearest(state, v.x, v.y, CONFIG.nests.siegeRange);
        if (nest) return { x: nest.x, y: nest.y, radius: Vide.Nests.radius(nest) + 250, nest };
        return { x: v.x, y: v.y, radius: R + 260 };
      }
      default: return { x: v.x, y: v.y, radius: R + 260 };
    }
  }

  // Ennemi à combattre : l'ombre la plus proche dans la zone défendue, sinon un colosse hostile.
  function enemyFor(game, b, a) {
    const shadow = Shadows.nearest(game, b.x, b.y, Infinity, (s) => Math.hypot(s.x - a.x, s.y - a.y) <= a.radius);
    if (shadow) return shadow;
    // En siège, une fois ses défenseurs dispersés : le cœur du nid.
    if (a.nest) return Vide.Nests.target(a.nest);
    return Vide.Colossus ? Vide.Colossus.target(game, a.x, a.y, a.radius) : null;
  }

  // L'ennemi visé est réévalué quatre fois par seconde, et aussitôt s'il tombe ou quitte la zone défendue :
  // avec des centaines d'êtres, chercher à chaque pas coûterait trop.
  const RETARGET = 0.25;

  function stillValid(e, a) {
    if (!e) return false;
    if (e.nest) return a.nest === e.nest && e.nest.hp > 0;
    if (e.colossus) return Vide.Colossus.engaged(e.colossus) && Math.hypot(e.x - a.x, e.y - a.y) <= a.radius + e.radius;
    return e.hp > 0 && !e.gone && Math.hypot(e.x - a.x, e.y - a.y) <= a.radius;
  }

  function currentEnemy(game, b, a, dt) {
    b.enemyCheck = (b.enemyCheck || 0) - dt;
    if (b.enemyCheck > 0 && stillValid(b.enemy, a)) return b.enemy;
    b.enemyCheck = RETARGET;
    b.enemy = enemyFor(game, b, a);
    return b.enemy;
  }

  function enemyRadius(enemy) {
    return enemy.colossus || enemy.nest ? enemy.radius : Shadows.kind(enemy.kind).radius;
  }

  function damageEnemy(game, enemy, amount, melee) {
    if (enemy.colossus) Vide.Colossus.hit(game, enemy.colossus, amount, melee);
    else if (enemy.nest) Vide.Nests.hit(game, enemy.nest, amount);
    else Shadows.damage(enemy, amount);
  }

  // Sans ennemi : en garde, ronde autour du cœur du village ; en escorte, cortège autour de la lumière.
  function formation(game, b, a, speed, dt) {
    b.task = 'idle';
    if (game.state.army.posture === 'escorte') {
      const angle = b.phase + game.time * 0.4;
      const r = 45 + (b.id % 3) * 16;
      Colony.steer(b, a.x + Math.cos(angle) * r, a.y + Math.sin(angle) * r, speed * 1.3, dt);
      return;
    }
    const v = b.village;
    const R = Math.max(60, Territory.radius(v) * 0.55);
    const angle = b.phase + game.time * 0.04;
    Colony.steer(b, v.x + Math.cos(angle) * R, v.y + Math.sin(angle) * R, speed * 0.5, dt);
  }

  const ROLES = {
    // Mêlée : fondre sur l'ombre la plus proche dans la zone défendue.
    guard(game, b, dt, speed) {
      const sp = Colony.species(b.species);
      const a = anchor(game, b);
      const enemy = currentEnemy(game, b, a, dt);
      if (!enemy) return formation(game, b, a, speed, dt);
      b.task = 'fight';
      const d = Colony.steer(b, enemy.x, enemy.y, speed, dt);
      if (d <= sp.range + enemyRadius(enemy) && b.cd <= 0) {
        b.cd = sp.cooldown;
        b.flash = 1;
        damageEnemy(game, enemy, sp.damage * Colony.statsOf(game, b).armyDamage, true);
      }
    },

    // Distance : garder l'ombre à bonne portée et tirer.
    ranged(game, b, dt, speed) {
      const sp = Colony.species(b.species);
      const a = anchor(game, b);
      const enemy = currentEnemy(game, b, a, dt);
      if (!enemy) return formation(game, b, a, speed, dt);
      b.task = 'fight';
      const dx = enemy.x - b.x, dy = enemy.y - b.y;
      // Distance au bord de la cible (un colosse est immense : on reste hors de son corps).
      const d = (Math.hypot(dx, dy) || 1) - (enemy.colossus ? enemy.radius * 0.8 : 0);
      if (d > sp.range * 0.9) Colony.steer(b, enemy.x, enemy.y, speed, dt);
      else if (d < sp.range * 0.45) Colony.steer(b, b.x - dx, b.y - dy, speed, dt);
      else Colony.steer(b, b.x, b.y, speed, dt);
      if (d <= sp.range && b.cd <= 0) {
        b.cd = sp.cooldown;
        b.flash = 1;
        const siege = enemy.colossus || enemy.nest ? sp.siege || 1 : 1;
        fire(game, b.x, b.y, enemy, sp.damage * siege * Colony.statsOf(game, b).armyDamage, sp.siege ? 'harpoon' : 'ally', siege);
      }
    },

    // Soin : rejoindre l'allié le plus blessé (être ou lumière du joueur) et le soigner.
    // Le blessé est choisi deux fois par seconde ; on le garde tant qu'il en a besoin.
    healer(game, b, dt, speed) {
      const sp = Colony.species(b.species);
      const v = game.vitality;
      const { player } = game.state;
      b.healCheck = (b.healCheck || 0) - dt;
      let best = b.patient;
      const needs = (o) => (o === player ? v.hp < game.stats.vitality
        : !o.removed && Colony.isActive(o) && o.hp < Colony.maxHp(game, o));
      if (b.healCheck <= 0 || (best && !needs(best))) {
        b.healCheck = 0.5;
        best = null;
        let worst = 1;
        for (const o of game.colony.beings) {
          if (o === b || !Colony.isActive(o) || o.hp === null) continue;
          if (Math.abs(o.x - b.x) > 450 || Math.abs(o.y - b.y) > 450) continue;
          const ratio = o.hp / Colony.maxHp(game, o);
          if (ratio < worst && Math.hypot(o.x - b.x, o.y - b.y) < 450) {
            worst = ratio;
            best = o;
          }
        }
        const playerRatio = v.hp / game.stats.vitality;
        if (playerRatio < worst && Math.hypot(player.x - b.x, player.y - b.y) < 450) best = player;
        b.patient = best;
      }
      b.healing = null;
      if (!best) return formation(game, b, anchor(game, b), speed, dt);
      b.task = 'heal';
      const d = Math.hypot(best.x - b.x, best.y - b.y);
      if (d > sp.range * 0.6) Colony.steer(b, best.x, best.y, speed, dt);
      else Colony.steer(b, b.x, b.y, speed, dt);
      if (d <= sp.range) {
        b.healing = best;
        const amount = sp.heal * Colony.statsOf(game, b).armyDamage * dt;
        if (best === player) v.hp = Math.min(game.stats.vitality, v.hp + amount);
        else best.hp = Math.min(Colony.maxHp(game, best), best.hp + amount);
      }
    },
  };
  Object.assign(Colony.ROLES, ROLES);

  function update(game, dt) {
    updateVitality(game, dt);
    updateProjectiles(game, dt);
    updateTowers(game, dt);
    for (const [v, h] of game.heartHurt) {
      if (h <= dt * 2) game.heartHurt.delete(v);
      else game.heartHurt.set(v, h - dt * 2);
    }
  }

  function armySize(state) {
    let n = 0;
    for (const sp of Vide.SPECIES) if (sp.army) n += Villages.count(state, sp.id);
    return n;
  }

  Vide.Combat = {
    POSTURES, create, strike, hurtPlayer, hurtBeing, disperse, pulseHit, fire, setPosture, anchor, armySize, update,
  };
})(globalThis.Vide);
