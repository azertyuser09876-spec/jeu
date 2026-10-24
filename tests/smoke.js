// Test de fumée dans un vrai navigateur : `node tests/smoke.js` (nécessite Playwright).
// Ouvre le jeu, joue quelques secondes et vérifie qu'aucune erreur JavaScript ne survient.
'use strict';
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const checks = [];
  const check = (ok, label) => checks.push({ ok, label });
  const player = () => page.evaluate(() => ({ ...Vide.game.state.player }));

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);

  // Clavier : D (position physique, donc aussi D en AZERTY) pendant une seconde.
  let before = await player();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  let after = await player();
  check(after.x - before.x > 50, 'le clavier déplace la lumière vers la droite');

  // Souris : maintenir le clic au-dessus de la lumière.
  before = after;
  await page.mouse.move(640, 100);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  after = await player();
  check(before.y - after.y > 50, 'le clic maintenu attire la lumière vers le pointeur');

  // Se promener quelques secondes doit rapporter de la lumière.
  for (const key of ['KeyA', 'KeyS', 'KeyD', 'KeyW', 'KeyA']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(1200);
    await page.keyboard.up(key);
  }
  const collected = await page.evaluate(() => Vide.game.state.stats.collected);
  check(collected > 0, `se promener récolte de la lumière (${collected} particules)`);

  // Achats : touche 1, puis clic sur la deuxième amélioration.
  await page.evaluate(() => { Vide.game.state.light += 1000; Vide.game.state.totalLight += 1000; });
  await page.waitForTimeout(100);
  await page.keyboard.press('Digit1');
  await page.click('#upgrade-list li:nth-child(2) .upgrade');
  const levels = await page.evaluate(() => ({ ...Vide.game.state.upgrades }));
  check(levels.reach === 1, 'la touche 1 achète la première amélioration');
  check(levels.speed === 1, 'un clic achète une amélioration');
  const visible = await page.$$eval('#upgrade-list li:not([hidden])', (els) => els.length);
  check(visible === 4, `les améliorations se dévoilent (${visible} visibles)`);

  // Capture facultative : `node tests/smoke.js capture.png`
  const shot = process.argv[2];
  if (shot) {
    await page.waitForTimeout(1800);
    await page.screenshot({ path: shot });
  }

  await browser.close();
  check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' :\n    ' + errors.join('\n    ') : ''));
  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
})();
