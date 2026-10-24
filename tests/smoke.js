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

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1000);

  const shot = process.argv[2];
  if (shot) await page.screenshot({ path: shot });

  await browser.close();
  if (errors.length) {
    console.log('✗ erreurs :\n  ' + errors.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('✓ le jeu tourne sans erreur');
  }
})();
