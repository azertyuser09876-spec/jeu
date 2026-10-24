// Son génératif (WebAudio) : tout est synthétisé, aucun fichier audio.
// Démarre au premier geste du joueur (exigence des navigateurs). Réglages gardés à part de la sauvegarde.
(function (Vide) {
  'use strict';
  const { util } = Vide;

  const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];
  // Note fondamentale (MIDI) de la nappe d'ambiance de chaque zone.
  const ZONE_ROOT = { calme: 57, brume: 55, courants: 59, murmure: 52, eclat: 62, gouffre: 45 };

  const audio = {
    ctx: null,
    master: null,
    enabled: true,
    volume: 0.6,
    last: {},          // dernier instant de chaque son (pour en limiter la fréquence)
    ambient: null,
    root: ZONE_ROOT.calme,
    seen: { collected: -1, pulse: -1, glow: 0 },
    heartbeatIn: 0,
  };

  // --- Réglages ---

  function loadSettings() {
    audio.enabled = Vide.Settings.get('enabled', true) !== false;
    const volume = Vide.Settings.get('volume', 0.6);
    if (Number.isFinite(volume)) audio.volume = util.clamp(volume, 0, 1);
  }

  function saveSettings() {
    Vide.Settings.set('enabled', audio.enabled);
    Vide.Settings.set('volume', audio.volume);
  }

  function applyVolume() {
    if (!audio.master) return;
    const target = audio.enabled ? audio.volume : 0;
    audio.master.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.05);
  }

  function setEnabled(on) {
    audio.enabled = on;
    applyVolume();
    saveSettings();
  }

  function setVolume(v) {
    audio.volume = util.clamp(v, 0, 1);
    applyVolume();
    saveSettings();
  }

  // --- Démarrage ---

  function start() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    const comp = audio.ctx.createDynamicsCompressor();
    comp.connect(audio.ctx.destination);
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0;
    audio.master.connect(comp);
    applyVolume();
    startAmbient();
  }

  function init() {
    loadSettings();
    const go = () => start();
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Limite la fréquence d'un son (en secondes).
  function throttle(name, gap) {
    const now = audio.ctx.currentTime;
    if (audio.last[name] && now - audio.last[name] < gap) return false;
    audio.last[name] = now;
    return true;
  }

  // --- Briques de synthèse ---

  function tone({ freq, type = 'sine', dur = 0.3, gain = 0.1, attack = 0.005, glideTo = null, delay = 0, filter = null }) {
    const ctx = audio.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      node = f;
    }
    node.connect(env);
    env.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  let noiseBuffer = null;
  function noise({ dur = 0.4, gain = 0.05, from = 800, to = null, q = 1, type = 'bandpass', delay = 0 }) {
    const ctx = audio.ctx;
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(env);
    env.connect(audio.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const note = (offset) => midi(audio.root + offset);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // --- Sons du jeu ---

  const SOUNDS = {
    collect() {
      if (!throttle('collect', 0.07)) return;
      const f = note(12 + pick(PENTATONIC));
      tone({ freq: f, dur: 0.35, gain: 0.045 });
      tone({ freq: f * 2, dur: 0.2, gain: 0.01 });
    },
    pulse() {
      noise({ dur: 0.7, gain: 0.07, from: 400, to: 1800, q: 0.8 });
      tone({ freq: 110, glideTo: 55, dur: 0.7, gain: 0.12 });
    },
    deposit() {
      if (!throttle('deposit', 0.3)) return;
      tone({ freq: note(24 + pick(PENTATONIC)), type: 'triangle', dur: 0.5, gain: 0.025 });
    },
    buy() {
      tone({ freq: note(12), dur: 0.3, gain: 0.05 });
      tone({ freq: note(19), dur: 0.4, gain: 0.05, delay: 0.08 });
    },
    birth() {
      [0, 4, 7, 12].forEach((n, i) => tone({ freq: note(12 + n), dur: 0.5, gain: 0.04, delay: i * 0.09 }));
    },
    built() {
      [0, 7, 12].forEach((n, i) => tone({ freq: note(n), type: 'triangle', dur: 0.8, gain: 0.05, delay: i * 0.12 }));
    },
    tide() {
      tone({ freq: 55, type: 'sawtooth', dur: 3, gain: 0.05, attack: 1.2, filter: 300 });
      tone({ freq: 55.8, type: 'sawtooth', dur: 3, gain: 0.05, attack: 1.2, filter: 300 });
    },
    shadowDown() {
      if (!throttle('shadowDown', 0.08)) return;
      tone({ freq: 160, glideTo: 50, type: 'triangle', dur: 0.35, gain: 0.07 });
      noise({ dur: 0.25, gain: 0.03, from: 300, type: 'lowpass' });
    },
    hurt() {
      if (!throttle('hurt', 0.25)) return;
      tone({ freq: 90, glideTo: 55, dur: 0.25, gain: 0.14 });
      noise({ dur: 0.2, gain: 0.04, from: 200, type: 'lowpass' });
    },
    dispersed() {
      tone({ freq: 620, glideTo: 70, dur: 1.6, gain: 0.08 });
    },
    footfall(gain) {
      tone({ freq: 44, glideTo: 30, dur: 0.5, gain: 0.3 * gain });
      noise({ dur: 0.3, gain: 0.08 * gain, from: 140, type: 'lowpass' });
    },
    quake() {
      tone({ freq: 50, glideTo: 25, dur: 0.9, gain: 0.3 });
      noise({ dur: 0.6, gain: 0.1, from: 180, type: 'lowpass' });
    },
    colossusAttack() {
      tone({ freq: 80, glideTo: 170, type: 'sawtooth', dur: 1.3, gain: 0.05, attack: 0.6, filter: 420 });
    },
    sealBroken() {
      for (const [ratio, g] of [[1, 0.07], [2.76, 0.03], [5.4, 0.015]]) {
        tone({ freq: 523 * ratio, dur: 2.2, gain: g });
      }
    },
    tamed() {
      [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: note(n), dur: 4, gain: 0.04, attack: 0.8, delay: i * 0.15 }));
    },
    // Une pulsation de la Méduse : un battement grave, feutré, comme sous l'eau.
    medusa(gain) {
      tone({ freq: 62, glideTo: 48, dur: 1.2, gain: 0.18 * gain, attack: 0.25 });
      noise({ dur: 0.9, gain: 0.03 * gain, from: 260, type: 'lowpass' });
    },
    // Un trait de baliste : un claquement sec, puis le sifflement du trait.
    bolt() {
      if (!throttle('bolt', 0.15)) return;
      noise({ dur: 0.12, gain: 0.08, from: 900, type: 'lowpass' });
      noise({ dur: 0.4, gain: 0.03, from: 3000, to: 1200, q: 4, delay: 0.05 });
    },
    // Des chaînes qui se tendent : un grincement grave et métallique.
    chained() {
      tone({ freq: 70, glideTo: 95, type: 'sawtooth', dur: 1.1, gain: 0.06, filter: 500 });
      noise({ dur: 0.8, gain: 0.04, from: 1600, to: 900, q: 8 });
    },
    web() {
      noise({ dur: 0.9, gain: 0.05, from: 2400, to: 600, q: 6 });
      tone({ freq: 880, glideTo: 660, dur: 0.6, gain: 0.02 });
    },
    lore() {
      tone({ freq: note(24), dur: 1.2, gain: 0.02 });
      tone({ freq: note(31), dur: 1.4, gain: 0.015, delay: 0.25 });
    },
    heartbeat(gain) {
      tone({ freq: 52, glideTo: 38, dur: 0.22, gain: 0.25 * gain });
      tone({ freq: 50, glideTo: 36, dur: 0.25, gain: 0.18 * gain, delay: 0.26 });
    },
  };

  // --- Nappe d'ambiance : deux voix douces qui glissent vers la note de chaque zone ---

  function startAmbient() {
    const ctx = audio.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    filter.connect(gain);
    gain.connect(audio.master);
    const voices = [
      { type: 'sine', offset: -12 },
      { type: 'triangle', offset: -5 },
      { type: 'sine', offset: 7 },
    ].map((v) => {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = note(v.offset);
      osc.connect(filter);
      osc.start();
      return { osc, offset: v.offset };
    });
    audio.ambient = { voices, filter, gain };
  }

  function updateAmbient(game) {
    const zone = game.region.zone;
    const root = ZONE_ROOT[zone.id] || ZONE_ROOT.calme;
    if (root === audio.root) return;
    audio.root = root;
    if (!audio.ambient) return;
    const t = audio.ctx.currentTime;
    for (const v of audio.ambient.voices) v.osc.frequency.setTargetAtTime(note(v.offset), t, 1.5);
    // Le brouillard étouffe le son.
    audio.ambient.filter.frequency.setTargetAtTime(700 - 400 * zone.fog, t, 1.5);
  }

  // --- Lecture de l'état du jeu ---

  function play(name, arg) {
    if (!audio.ctx || !audio.enabled || audio.ctx.state !== 'running') return;
    SOUNDS[name](arg);
  }

  function readEvents(game) {
    if (!audio.ctx) return;
    const { player } = game.state;
    for (const e of game.events) {
      switch (e.type) {
        case 'birth': play('birth'); break;
        case 'built': case 'repaired': play('built'); break;
        case 'tide': case 'raid': play('tide'); break;
        case 'shadowDown': play('shadowDown'); break;
        case 'dispersed': play('dispersed'); break;
        case 'footfall': {
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d < 1500) play('footfall', 1 - d / 1500);
          break;
        }
        case 'quake':
          if (!e.local || Math.hypot(e.points[0].x - player.x, e.points[0].y - player.y) < 900) play('quake');
          break;
        case 'phase': play('quake'); break;
        case 'colossusAttack': play('colossusAttack'); break;
        case 'web': play('web'); break;
        case 'bolt': play('bolt'); break;
        case 'medusaPulse': {
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d < 2000) play('medusa', 1 - d / 2000);
          break;
        }
        case 'chained': play('chained'); break;
        case 'engineBuilt': play('built'); break;
        case 'sealBroken': case 'kneel': play('sealBroken'); break;
        case 'colossusTamed': case 'renaissance': play('tamed'); break;
        case 'lore': case 'zoneDiscovered': play('lore'); break;
        case 'heartbeat': play('heartbeat', 1); break;
      }
    }
  }

  function update(game, dt) {
    if (!audio.ctx) return;
    updateAmbient(game);
    const s = audio.seen;
    const collected = game.state.stats.collected;
    if (s.collected >= 0 && collected > s.collected) play('collect');
    s.collected = collected;
    if (s.pulse >= 0 && game.pulse.id !== s.pulse) play('pulse');
    s.pulse = game.pulse.id;
    let glow = 0;
    for (const g of game.colony.glows.values()) glow = Math.max(glow, g);
    if (glow > s.glow + 0.2) play('deposit');
    s.glow = glow;
    if (game.vitality.hurt > 0.95) play('hurt');

    // Le battement d'un colosse pas encore apaisé, plus fort à mesure qu'on approche.
    audio.heartbeatIn -= dt;
    if (audio.heartbeatIn <= 0) {
      audio.heartbeatIn = 1.6;
      const { player } = game.state;
      for (const c of game.colossi) {
        if (c.mode === 'resident' || c.mode === 'home' || c.mode === 'calm') continue;
        const d = Math.hypot(c.x - player.x, c.y - player.y);
        if (d < 7000) play('heartbeat', 0.15 + 0.85 * (1 - d / 7000));
      }
    }
  }

  audio.init = init;
  audio.start = start;
  audio.play = play;
  audio.readEvents = readEvents;
  audio.update = update;
  audio.setEnabled = setEnabled;
  audio.setVolume = setVolume;
  Vide.Audio = audio;
})(globalThis.Vide);
