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
  // Une particule est posée sur le chemin pour que la vérification ne dépende pas du hasard.
  await page.evaluate(() => {
    const p = Vide.game.state.player;
    Vide.Field.place(Vide.game.field, p.x - 120, p.y, false, true);
  });
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
  await page.locator('#shop-list li:not([hidden]) .item').nth(1).click();
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

  // Lueurs : l'onglet êtres permet d'en éveiller une, qui apparaît dans le monde.
  await page.evaluate(() => { const s = Vide.game.state; s.light += 1000; s.totalLight += 1000; });
  await page.waitForTimeout(100);
  await page.click('.tab:has-text("êtres")');
  await page.click('#shop-list li:not([hidden]) .item:has-text("Lueur")');
  await page.waitForTimeout(300);
  const beings = await page.evaluate(() => Vide.game.colony.beings.length);
  check(beings === 1, 'une lueur s’éveille depuis l’onglet êtres');

  // Bâtiments : avec un bâtisseur et un territoire assez grand, un nid se planifie.
  await page.evaluate(() => {
    const s = Vide.game.state;
    s.light += 1e5; s.totalLight += 1e5;
    s.territory.area = Math.PI * 200 * 200;
    s.beings.batisseur = 1;
  });
  await page.waitForTimeout(200);
  await page.click('.tab:has-text("bâtiments")');
  await page.click('#shop-list li:not([hidden]) .item:has-text("Nid")');
  // Le bâtisseur doit d'abord rejoindre le chantier.
  await page.waitForTimeout(3000);
  const site = await page.evaluate(() => Vide.game.state.buildings[0]);
  check(site && site.type === 'nid' && site.work > 0, 'un nid planifié est mis en chantier par le bâtisseur');

  // Ombres : la pulsation en blesse une, qui se dissipe et laisse un écho ; l'armée reçoit un ordre.
  await page.evaluate(() => {
    const g = Vide.game;
    const p = g.state.player;
    const s = Vide.Shadows.spawn(g, 'errante', p.x + 60, p.y, 'roam');
    s.hp = 1;
    g.pulse.cooldown = 0;
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  const echoes = await page.evaluate(() => Vide.game.state.echoes);
  check(echoes > 0 && (await page.isVisible('#echoes')), 'la pulsation dissipe une ombre, qui laisse un écho ◆');
  await page.evaluate(() => { Vide.game.state.beings.gardien = 1; });
  await page.waitForTimeout(300);
  await page.click('#orders button[data-posture="escorte"]');
  const posture = await page.evaluate(() => Vide.game.state.army.posture);
  check(posture === 'escorte', 'la barre d’ordres change l’ordre de l’armée');

  // Zones et carte : visiter une autre région, puis ouvrir la carte avec M.
  await page.evaluate(() => {
    const p = Vide.game.state.player;
    p.x = 9000; p.y = 4000;
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('m');
  await page.waitForTimeout(200);
  check(await page.isVisible('#map'), 'la touche M ouvre la carte des régions explorées');
  await page.keyboard.press('Escape');
  check(!(await page.isVisible('#map')), 'Échap referme la carte');
  await page.evaluate(() => { const p = Vide.game.state.player; p.x = 0; p.y = 0; });

  // Colosse : après assez d'ombres vaincues, son battement s'entend ; l'approcher le réveille.
  await page.evaluate(() => { Vide.game.state.stats.shadows = 15; });
  await page.waitForTimeout(300);
  const heard = await page.evaluate(() => Vide.game.colossi.length === 1 && Vide.game.state.colossi.veilleur === 'heard');
  check(heard, 'le battement du Veilleur s’entend après 15 ombres vaincues');
  await page.evaluate(() => {
    const c = Vide.game.colossi[0];
    const p = Vide.game.state.player;
    p.x = c.x - 600; p.y = c.y;
  });
  await page.waitForTimeout(600);
  const found = await page.evaluate(() => Vide.game.state.colossi.veilleur === 'found');
  check(found && (await page.isVisible('#boss')), 'approcher le Veilleur le réveille, sa jauge de combat apparaît');
  await page.evaluate(() => { const p = Vide.game.state.player; p.x = 0; p.y = 0; });

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
