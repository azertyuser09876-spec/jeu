const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const el = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  lives: document.getElementById('lives'),
  overlay: document.getElementById('overlay'),
  msg: document.getElementById('msg'),
  play: document.getElementById('play'),
};

let best = 0;
try { best = +localStorage.getItem('etoiles-best') || 0; } catch (e) {}
el.best.textContent = best;

const player = { x: W / 2, y: H - 50, r: 22, target: W / 2 };
let items, score, lives, spawnTimer, elapsed, running, last;
const keys = {};

// Étoiles de fond (décor)
const bg = Array.from({ length: 60 }, () => ({
  x: Math.random() * W, y: Math.random() * H,
  s: Math.random() * 1.5 + .5, v: Math.random() * 20 + 10,
}));

function start() {
  items = [];
  score = 0; lives = 3; spawnTimer = 0; elapsed = 0;
  player.x = player.target = W / 2;
  running = true;
  el.overlay.classList.add('hidden');
  updateHud();
  last = performance.now();
  requestAnimationFrame(loop);
}

function updateHud() {
  el.score.textContent = score;
  el.lives.textContent = '❤'.repeat(Math.max(lives, 0));
}

function gameOver() {
  running = false;
  if (score > best) {
    best = score;
    el.best.textContent = best;
    try { localStorage.setItem('etoiles-best', best); } catch (e) {}
    el.msg.textContent = `Nouveau record : ${score} ⭐`;
  } else {
    el.msg.textContent = `Score : ${score} — record : ${best}`;
  }
  el.play.textContent = 'Rejouer';
  el.overlay.classList.remove('hidden');
}

function spawn() {
  const bomb = Math.random() < Math.min(.25 + elapsed / 200, .5);
  items.push({
    x: 20 + Math.random() * (W - 40),
    y: -20,
    r: bomb ? 20 : 14,
    v: 120 + Math.random() * 80 + elapsed * 3,
    bomb,
    rot: 0,
  });
}

function update(dt) {
  elapsed += dt;

  if (keys.ArrowLeft || keys.a) player.target -= 420 * dt;
  if (keys.ArrowRight || keys.d) player.target += 420 * dt;
  player.target = Math.max(player.r, Math.min(W - player.r, player.target));
  player.x += (player.target - player.x) * Math.min(1, dt * 14);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawn();
    spawnTimer = Math.max(.25, .8 - elapsed / 90);
  }

  for (const it of items) {
    it.y += it.v * dt;
    it.rot += dt * 3;
    if (Math.hypot(it.x - player.x, it.y - player.y) < it.r + player.r - 4) {
      it.dead = true;
      if (it.bomb) { lives--; } else { score++; }
      updateHud();
    } else if (it.y > H + 30) {
      it.dead = true;
    }
  }
  items = items.filter(it => !it.dead);

  if (lives <= 0) gameOver();
}

function draw(dt) {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#fff';
  for (const s of bg) {
    s.y = (s.y + s.v * dt) % H;
    ctx.globalAlpha = .4 + s.s / 3;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const it of items) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.font = `${it.r * 2}px serif`;
    ctx.fillText(it.bomb ? '☄️' : '⭐', 0, 0);
    ctx.restore();
  }

  ctx.font = `${player.r * 2}px serif`;
  ctx.fillText('🚀', player.x, player.y);
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, .05);
  last = now;
  if (running) update(dt);
  draw(dt);
  if (running) requestAnimationFrame(loop);
}

// Contrôles
function pointerX(e) {
  const rect = canvas.getBoundingClientRect();
  player.target = (e.clientX - rect.left) * (W / rect.width);
}
window.addEventListener('pointermove', pointerX);
window.addEventListener('pointerdown', pointerX);
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === 'Enter' || e.key === ' ') && !running) start();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });
el.play.addEventListener('click', start);

// Premier rendu (fond + fusée) derrière le menu
last = performance.now();
items = [];
draw(0);
