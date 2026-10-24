// Le projecteur : joue des tableaux (cinématiques) peints en code, plein écran et sans texte. Bandes noires,
// fondus au noir entre les plans ; un toucher, Échap, Espace ou Entrée passe le tableau. Pendant qu'il joue, le
// monde attend. Les tableaux eux-mêmes sont dans scenes.js (Vide.Scenes) ; ceux déjà vus restent dans
// state.cinematics et se revoient depuis le menu. Un réglage permet de ne plus les jouer.
(function (Vide) {
  'use strict';

  const FADE = 0.6;       // fondu au noir au début et à la fin de chaque plan (secondes)
  const BARS = 0.09;      // hauteur de chaque bande noire (part de l'écran)

  function create(renderer) {
    const canvas = document.getElementById('cinema');
    const cin = { canvas, ctx: canvas.getContext('2d'), renderer, queue: [], current: null, w: 0, h: 0, dpr: 1 };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      skip(cin);
    });
    return cin;
  }

  const enabled = () => Vide.Settings.get('cinematics', true) !== false;

  // Met un tableau en file (le note comme vu). Déjà vu, ou les tableaux coupés : rien, sauf `force` (le menu).
  function play(cin, state, id, opts) {
    const scene = Vide.Scenes.get(id);
    if (!scene) return false;
    const seen = state.cinematics.includes(id);
    if (!seen) state.cinematics.push(id);
    if ((seen || !enabled()) && !(opts && opts.force)) return false;
    if (cin.queue.some((q) => q.id === id) || (cin.current && cin.current.id === id)) return false;
    cin.queue.push({ id, scene, t: 0, shot: -1, data: (opts && opts.data) || {} });
    return true;
  }

  const active = (cin) => Boolean(cin.current || cin.queue.length);

  // Passe le tableau en cours (le suivant, s'il y en a, se joue ensuite).
  function skip(cin) {
    cin.current = null;
    if (!cin.queue.length) cin.canvas.hidden = true;
  }

  function stop(cin) {
    cin.queue.length = 0;
    skip(cin);
  }

  const total = (scene) => scene.shots.reduce((sum, s) => sum + s.d, 0);

  function update(cin, state, dt) {
    if (!cin.current && cin.queue.length) {
      cin.current = cin.queue.shift();
      cin.canvas.hidden = false;
    }
    const cur = cin.current;
    if (!cur) return;
    cur.t += dt;
    // Un son au début de chaque plan, s'il en a un.
    let start = 0;
    let index = 0;
    while (index < cur.scene.shots.length - 1 && cur.t >= start + cur.scene.shots[index].d) {
      start += cur.scene.shots[index].d;
      index++;
    }
    if (index !== cur.shot) {
      cur.shot = index;
      const sound = cur.scene.shots[index].sound;
      if (sound) Vide.Audio.play(sound, 1);
    }
    if (cur.t >= total(cur.scene)) skip(cin);
  }

  function resize(cin) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (w === cin.w && h === cin.h && dpr === cin.dpr) return;
    cin.w = w;
    cin.h = h;
    cin.dpr = dpr;
    cin.canvas.width = Math.round(w * dpr);
    cin.canvas.height = Math.round(h * dpr);
  }

  function draw(cin, state) {
    const cur = cin.current;
    if (!cur) return;
    resize(cin);
    const { ctx, w, h } = cin;
    ctx.setTransform(cin.dpr, 0, 0, cin.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Le plan en cours, et le temps écoulé dans ce plan.
    let start = 0;
    let shot = cur.scene.shots[0];
    for (const s of cur.scene.shots) {
      shot = s;
      if (cur.t < start + s.d) break;
      start += s.d;
    }
    const t = Math.min(cur.t - start, shot.d);
    const g = {
      ctx, w, h, t, p: t / shot.d, time: cur.t, data: cur.data, state,
      // Échelle : un tableau est composé pour un écran de 1000 × 700, puis ajusté.
      u: Math.min(w / 1000, h / 700),
      cx: w / 2, cy: h / 2,
      glow: (color) => Vide.Scenes.glow(cin.renderer, color),
    };
    ctx.save();
    shot.draw(g);
    ctx.restore();

    // Fondus au noir, puis les bandes.
    ctx.globalCompositeOperation = 'source-over';
    const fadeIn = shot.fadeIn === undefined ? FADE : shot.fadeIn;
    const fadeOut = shot.fadeOut === undefined ? FADE : shot.fadeOut;
    let veil = 0;
    if (fadeIn > 0 && t < fadeIn) veil = 1 - t / fadeIn;
    if (fadeOut > 0 && shot.d - t < fadeOut) veil = Math.max(veil, 1 - (shot.d - t) / fadeOut);
    if (veil > 0) {
      ctx.globalAlpha = veil;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h * BARS);
    ctx.fillRect(0, h * (1 - BARS), w, h * BARS);
  }

  // Les événements de la simulation qui appellent un tableau (lus avant que l'interface ne les efface).
  function readEvents(cin, game) {
    const { state } = game;
    for (const e of game.events) {
      if (e.type === 'colossusFound') play(cin, state, 'rencontre:' + e.id);
      if (e.type === 'colossusTamed') {
        play(cin, state, 'apaisement:' + e.id);
        if (e.id === 'dormeur') play(cin, state, 'epilogue');
      }
      if (e.type === 'renaissance') play(cin, state, 'renaissance');
    }
  }

  Vide.Cinema = { FADE, BARS, create, enabled, play, active, skip, stop, update, draw, readEvents };
})(globalThis.Vide);
