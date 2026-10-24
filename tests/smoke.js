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

  const shot = process.argv[2];
  if (shot) await page.screenshot({ path: shot });

  await browser.close();
  check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' :\n    ' + errors.join('\n    ') : ''));
  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
})();
