// Combat : vitalité de la lumière, coups des ombres, projectiles, tours, comportements de l'armée.
(function (Vide) {
  'use strict';
  const { CONFIG, util, Colony, Structures, Shadows, Territory } = Vide;

  const POSTURES = ['garde', 'escorte', 'chasse'];

  function create(game) {
    game.vitality = {
      hp: game.stats.vitality,
      hurt: 0,          // éclat bref après une blessure (affichage)
      lastHurt: -99,
      invulnerable: 0,  // secondes restantes d'invulnérabilité
    };
    game.projectiles = [];
    game.towerCd = new Map();
    game.foyerHurt = 0;
    game.lastFoyerAlert = -99;
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

  // Lumière vaincue : elle se disperse et renaît au foyer, en perdant une part de sa lumière.
  function disperse(game) {
    const { state } = game;
    const lost = state.light * CONFIG.combat.dispersalLoss;
    state.light -= lost;
    state.player.x = 0;
    state.player.y = 0;
    game.velocity.x = game.velocity.y = 0;
    game.vitality.hp = game.stats.vitality;
    game.vitality.invulnerable = CONFIG.combat.invulnerable;
    game.field.particles.length = 0;
    Vide.Field.fill(game.field, 0, 0, game.stats);
    Vide.Sim.emit(game, 'dispersed', { lost });
  }

  function hurtBeing(game, b, amount) {
    if (!Colony.isActive(b)) return;
    b.hp -= amount;
    b.lastHurt = game.time;
    b.hurt = 1;
    if (b.hp > 0) return;
    // Vaincu : il s'éteint, lâche ce qu'il portait, et se rallumera au foyer plus tard.
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
      case 'building':
        game.colony.flashes.set(target.ref, -1); // éclat négatif : le bâtiment vacille
        if (Structures.damage(game, target.ref, amount)) {
          Vide.Sim.emit(game, 'broken', { building: target.ref.type });
        }
        break;
      case 'foyer': {
        // Les ombres au foyer dévorent la réserve de lumière.
        const { state } = game;
        state.light = Math.max(0, state.light - amount * CONFIG.combat.foyerDrain);
        game.foyerHurt = 1;
        if (game.time - game.lastFoyerAlert > 15) {
          game.lastFoyerAlert = game.time;
          Vide.Sim.emit(game, 'foyerAttacked');
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
      const inside = Territory.isInside(game.state, player.x, player.y);
      v.hp += CONFIG.combat.regen * (inside ? CONFIG.combat.insideRegen : 1) * dt;
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
  }

  // --- Projectiles (traits des étincelles et des tours), légèrement guidés ---

  function fire(game, x, y, target, damage, source) {
    const dx = target.x - x, dy = target.y - y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = CONFIG.combat.projectileSpeed;
    game.projectiles.push({
      x, y, vx: (dx / d) * speed, vy: (dy / d) * speed,
      target, damage, source, life: CONFIG.combat.projectileLife,
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
      const hit = Shadows.nearest(game, p.x, p.y, CONFIG.combat.projectileHit + 10);
      if (hit && Math.hypot(hit.x - p.x, hit.y - p.y) <= CONFIG.combat.projectileHit + Shadows.kind(hit.kind).radius) {
        Shadows.damage(hit, p.damage);
        list.splice(i, 1);
        continue;
      }
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  // --- Tours de lumière ---

  function updateTowers(game, dt) {
    for (const b of game.state.buildings) {
      const d = Structures.def(b.type);
      if (!d.tower || !Structures.isWorking(b)) continue;
      const cd = (game.towerCd.get(b) || 0) - dt;
      if (cd > 0) {
        game.towerCd.set(b, cd);
        continue;
      }
      const target = Shadows.nearest(game, b.x, b.y, d.tower.range);
      if (target) {
        fire(game, b.x, b.y, target, d.tower.damage * game.stats.armyDamage, 'tower');
        game.towerCd.set(b, d.tower.cooldown);
      } else {
        game.towerCd.set(b, 0);
      }
    }
  }

  // --- Armée ---

  function setPosture(state, posture) {
    if (!POSTURES.includes(posture)) return false;
    state.army.posture = posture;
    return true;
  }

  // Zone que l'armée défend selon l'ordre donné : centre et rayon d'engagement.
  function anchor(game) {
    const { state } = game;
    const R = Territory.radius(state);
    switch (state.army.posture) {
      case 'escorte': return { x: state.player.x, y: state.player.y, radius: 320 };
      case 'chasse': return { x: 0, y: 0, radius: R + 1400 };
      default: return { x: 0, y: 0, radius: R + 260 };
    }
  }

  function enemyFor(game, b, a) {
    return Shadows.nearest(game, b.x, b.y, Infinity, (s) => Math.hypot(s.x - a.x, s.y - a.y) <= a.radius);
  }

  // Sans ennemi : en garde, ronde autour du foyer ; en escorte, cortège autour de la lumière.
  function formation(game, b, a, speed, dt) {
    b.task = 'idle';
    if (game.state.army.posture === 'escorte') {
      const angle = b.phase + game.time * 0.4;
      const r = 45 + (b.id % 3) * 16;
      Colony.steer(b, a.x + Math.cos(angle) * r, a.y + Math.sin(angle) * r, speed * 1.3, dt);
      return;
    }
    const R = Math.max(60, Territory.radius(game.state) * 0.55);
    const angle = b.phase + game.time * 0.04;
    Colony.steer(b, Math.cos(angle) * R, Math.sin(angle) * R, speed * 0.5, dt);
  }

  const ROLES = {
    // Mêlée : fondre sur l'ombre la plus proche dans la zone défendue.
    guard(game, b, dt, speed) {
      const sp = Colony.species(b.species);
      const a = anchor(game);
      const enemy = enemyFor(game, b, a);
      if (!enemy) return formation(game, b, a, speed, dt);
      b.task = 'fight';
      const d = Colony.steer(b, enemy.x, enemy.y, speed, dt);
      if (d <= sp.range + Shadows.kind(enemy.kind).radius && b.cd <= 0) {
        b.cd = sp.cooldown;
        b.flash = 1;
        Shadows.damage(enemy, sp.damage * game.stats.armyDamage);
      }
    },

    // Distance : garder l'ombre à bonne portée et tirer.
    ranged(game, b, dt, speed) {
      const sp = Colony.species(b.species);
      const a = anchor(game);
      const enemy = enemyFor(game, b, a);
      if (!enemy) return formation(game, b, a, speed, dt);
      b.task = 'fight';
      const dx = enemy.x - b.x, dy = enemy.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > sp.range * 0.9) Colony.steer(b, enemy.x, enemy.y, speed, dt);
      else if (d < sp.range * 0.45) Colony.steer(b, b.x - dx, b.y - dy, speed, dt);
      else Colony.steer(b, b.x, b.y, speed, dt);
      if (d <= sp.range && b.cd <= 0) {
        b.cd = sp.cooldown;
        b.flash = 1;
        fire(game, b.x, b.y, enemy, sp.damage * game.stats.armyDamage, 'ally');
      }
    },

    // Soin : rejoindre l'allié le plus blessé (être ou lumière du joueur) et le soigner.
    healer(game, b, dt, speed) {
      const sp = Colony.species(b.species);
      let best = null;
      let worst = 1;
      for (const o of game.colony.beings) {
        if (o === b || !Colony.isActive(o) || o.hp === null) continue;
        const ratio = o.hp / Colony.maxHp(game, o);
        if (ratio < worst && Math.hypot(o.x - b.x, o.y - b.y) < 450) {
          worst = ratio;
          best = o;
        }
      }
      const v = game.vitality;
      const { player } = game.state;
      const playerRatio = v.hp / game.stats.vitality;
      if (playerRatio < worst && Math.hypot(player.x - b.x, player.y - b.y) < 450) {
        best = player;
        worst = playerRatio;
      }
      b.healing = null;
      if (!best) return formation(game, b, anchor(game), speed, dt);
      b.task = 'heal';
      const d = Math.hypot(best.x - b.x, best.y - b.y);
      if (d > sp.range * 0.6) Colony.steer(b, best.x, best.y, speed, dt);
      else Colony.steer(b, b.x, b.y, speed, dt);
      if (d <= sp.range) {
        b.healing = best;
        const amount = sp.heal * game.stats.armyDamage * dt;
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
    game.foyerHurt = Math.max(0, game.foyerHurt - dt * 2);
  }

  function armySize(state) {
    let n = 0;
    for (const sp of Vide.SPECIES) if (sp.army) n += state.beings[sp.id] || 0;
    return n;
  }

  Vide.Combat = {
    POSTURES, create, strike, hurtPlayer, hurtBeing, disperse, pulseHit, fire, setPosture, anchor, armySize, update,
  };
})(globalThis.Vide);
