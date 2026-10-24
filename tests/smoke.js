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

  const shotDir = process.argv[2];
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
  await page.click('#shop-list li:nth-child(2) .item');
  const levels = await page.evaluate(() => ({ ...Vide.game.state.upgrades }));
  check(levels.reach === 1, 'la touche 1 achète la première amélioration');
  check(levels.speed === 1, 'un clic achète une amélioration');
  const visible = await page.$$eval('#shop-list li:not([hidden])', (els) => els.length);
  check(visible === 5, `les améliorations se dévoilent (${visible} visibles)`);

  // Pulsation : la touche Espace la déclenche.
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const pulse = await page.evaluate(() => ({ ...Vide.game.pulse }));
  check(pulse.cooldown > 0, 'Espace déclenche la pulsation');

  // Sauvegarde : l'état survit à un rechargement (sauvegarde déclenchée en quittant la page).
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(Vide.game.state)));
  await page.reload();
  await page.waitForTimeout(300);
  const reloaded = await page.evaluate(() => JSON.parse(JSON.stringify(Vide.game.state)));
  check(
    reloaded.upgrades.reach === saved.upgrades.reach && reloaded.upgrades.speed === saved.upgrades.speed &&
      reloaded.totalLight >= saved.totalLight && reloaded.light >= saved.light,
    'la partie est retrouvée après rechargement'
  );

  // Foyer : à l'origine, l'onglet territoire permet de l'allumer.
  await page.evaluate(() => {
    const s = Vide.game.state;
    s.player.x = 20; s.player.y = 0;
    s.light += 500; s.totalLight += 500;
  });
  await page.waitForTimeout(100);
  await page.click('.tab:has-text("territoire")');
  await page.click('#shop-list li:not([hidden]) .item:has-text("Allumer le foyer")');
  await page.waitForTimeout(400);
  const lit = await page.evaluate(() => Vide.game.state.territory.lit);
  const toastText = await page.textContent('#toast');
  check(lit && toastText.includes('foyer'), 'le foyer s’allume depuis l’origine, avec un message');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'foyer.png') });

  // Absence : une sauvegarde vieille de 2 h fait grandir le territoire au rechargement.
  const radiusBefore = await page.evaluate(() => Vide.Territory.radius(Vide.game.state));
  await page.evaluate(() => {
    Vide.Storage.save(Vide.game.state);
    const save = JSON.parse(localStorage.getItem('le-vide/save'));
    save.savedAt -= 2 * 3600 * 1000;
    localStorage.setItem('le-vide/save', JSON.stringify(save));
    window.addEventListener('pagehide', (e) => e.stopImmediatePropagation(), { capture: true });
    Vide.Storage.readOnly = true; // empêche la sauvegarde de sortie d'écraser la sauvegarde vieillie
  });
  await page.reload();
  await page.waitForTimeout(300);
  const awayShown = await page.isVisible('#away');
  const radiusAfter = await page.evaluate(() => Vide.Territory.radius(Vide.game.state));
  check(awayShown && radiusAfter > radiusBefore + 20,
    `l’absence fait grandir le territoire (${Math.round(radiusBefore)} → ${Math.round(radiusAfter)}) et l’écran d’absence s’affiche`);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'absence.png') });
  await page.click('#away-close');
  check(!(await page.isVisible('#away')), 'l’écran d’absence se ferme');

  // Menu : Échap l'ouvre et met le jeu en pause.
  await page.keyboard.press('Escape');
  const t0 = await page.evaluate(() => Vide.game.state.stats.playTime);
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => Vide.game.state.stats.playTime);
  const menuOpen = await page.isVisible('#menu');
  check(menuOpen && t1 === t0, 'Échap ouvre le menu et met en pause');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'menu.png') });

  // Recommencer : confirmation, puis partie neuve, sans que la sauvegarde de sortie ne la réécrive.
  page.once('dialog', (d) => d.accept());
  await Promise.all([page.waitForNavigation(), page.click('#menu-reset')]);
  await page.waitForTimeout(300);
  const fresh = await page.evaluate(() => ({ total: Vide.game.state.totalLight, ups: Vide.game.state.upgrades }));
  check(fresh.total === 0 && Object.keys(fresh.ups).length === 0, 'recommencer efface la partie');
  await page.reload();
  await page.waitForTimeout(300);
  const totalAfterReset = await page.evaluate(() => Vide.game.state.totalLight);
  check(totalAfterReset === 0, 'la partie effacée ne revient pas au rechargement');

  // Captures facultatives : `node tests/smoke.js dossier/`
  if (shotDir) {
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(shotDir, 'jeu.png') });
  }

  await browser.close();
  check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' :\n    ' + errors.join('\n    ') : ''));
  for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
})();
