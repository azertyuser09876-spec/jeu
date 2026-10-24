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
  // Termine l'animation de lancement (après un rechargement), pour que les vérifications suivantes jouent.
  const wake = () => page.evaluate(() => { Vide.intro.t = 99; });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);

  // Éveil : au lancement, le monde attend la fin de l'animation ; une touche l'abrège.
  const launch = await page.evaluate(() => ({ time: Vide.game.time, on: document.body.classList.contains('launching') }));
  check(launch.on && launch.time === 0, 'au lancement, l’éveil se joue avant que le monde ne bouge');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'eveil.png') });

  // Clavier : D (position physique, donc aussi D en AZERTY) pendant une seconde.
  let before = await player();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  let after = await player();
  check(after.x - before.x > 50, 'le clavier abrège l’éveil et déplace la lumière vers la droite');

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
  await wake();
  await page.waitForTimeout(300);
  const reloaded = await page.evaluate(() => JSON.parse(JSON.stringify(Vide.game.state)));
  check(
    reloaded.upgrades.reach === saved.upgrades.reach && reloaded.upgrades.speed === saved.upgrades.speed &&
      reloaded.totalLight >= saved.totalLight && reloaded.light >= saved.light,
    'la partie est retrouvée après rechargement'
  );

  // Village : où que l'on soit, l'onglet territoire propose d'en fonder un, du type choisi.
  await page.evaluate(() => {
    const s = Vide.game.state;
    s.player.x = 400; s.player.y = -150;
    s.light += 500; s.totalLight += 500;
  });
  await page.waitForTimeout(100);
  await page.click('.tab:has-text("territoire")');
  await page.click('#shop-list li:not([hidden]) .item:has-text("Bastion")');
  await page.waitForTimeout(400);
  const founded = await page.evaluate(() => Vide.game.state.villages.map((v) => ({ type: v.type, x: Math.round(v.x) })));
  const announced = await page.evaluate(() => Vide.Away.history.some((t) => t.includes('premier village')));
  check(founded.length === 1 && founded[0].type === 'bastion' && Math.abs(founded[0].x - 400) < 30 && announced,
    'un village (bastion) se fonde là où l’on est, avec un message');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'village.png') });

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
    s.villages[0].area = Math.PI * 200 * 200;
    s.villages[0].beings.batisseur = 1;
  });
  await page.waitForTimeout(200);
  await page.click('.tab:has-text("bâtiments")');
  await page.click('#shop-list li:not([hidden]) .item:has-text("Nid")');
  // Le bâtisseur doit d'abord rejoindre le chantier.
  await page.waitForTimeout(3000);
  const site = await page.evaluate(() => Vide.game.state.villages[0].buildings[0]);
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
  await page.evaluate(() => { Vide.game.state.villages[0].beings.gardien = 1; });
  await page.waitForTimeout(300);
  await page.click('#orders button[data-posture="escorte"]');
  const posture = await page.evaluate(() => Vide.game.state.army.posture);
  check(posture === 'escorte', 'la barre d’ordres change l’ordre de l’armée');

  // Dispersion : la lumière éclate où elle tombe, l'écran s'éteint (monde en pause), puis elle renaît
  // au village le plus proche.
  const fallAt = await page.evaluate(() => {
    const g = Vide.game;
    const v = g.state.villages[0];
    g.state.player.x = v.x + 1500;
    g.state.player.y = v.y;
    const x = g.state.player.x;
    Vide.Combat.hurtPlayer(g, 1e9, x + 10, v.y);
    return x;
  });
  await page.waitForTimeout(300);
  const falling = await page.evaluate(() => ({
    kind: Vide.intro.kind, dark: document.body.classList.contains('dispersing'),
    time: Vide.game.time, cam: Vide.renderer.camera.x,
  }));
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'dispersion.png') });
  await page.waitForTimeout(500);
  const stillPaused = await page.evaluate(() => Vide.game.time);
  await page.waitForTimeout(3000);
  const reborn = await page.evaluate(() => {
    const v = Vide.game.state.villages[0];
    return { done: Vide.Intro.done(Vide.intro), d: Math.hypot(Vide.renderer.camera.x - v.x, Vide.renderer.camera.y - v.y) };
  });
  check(falling.kind === 'respawn' && falling.dark && Math.abs(falling.cam - fallAt) < 5 && stillPaused === falling.time &&
    reborn.done && reborn.d < 60, 'dispersée, la lumière éclate sur place puis renaît au village (animation)');

  // Tous les bâtiments, achevés puis éteints, se dessinent sans erreur (dans un village du bon type).
  await page.evaluate(() => {
    const s = Vide.game.state;
    const keep = { x: s.player.x, y: s.player.y };
    Vide.BUILDINGS.forEach((d, k) => {
      s.player.x = 20000 + k * 900; s.player.y = 20000;
      const v = Vide.Villages.found(s, d.only || 'jardins');
      v.buildings.push({ type: d.id, x: v.x + 60, y: v.y, work: d.work });
      v.buildings.push({ type: d.id, x: v.x - 60, y: v.y, work: d.work, broken: true });
    });
    s.player.x = 20000; s.player.y = 20000;
    Vide.Render.snapCamera(Vide.renderer, Vide.game);
    Vide.renderer.zoom = 0.55;
    window.keepPlayer = keep;
  });
  await page.waitForTimeout(800);
  for (let k = 0; k < 13; k += 3) {
    await page.evaluate((k) => {
      const p = Vide.game.state.player;
      p.x = 20000 + k * 900; p.y = 20000;
    }, k);
    await page.waitForTimeout(150);
  }
  check(errors.length === 0, 'chaque bâtiment se dessine, achevé ou éteint');
  await page.evaluate(() => {
    const s = Vide.game.state;
    s.villages.length = 1;
    Object.assign(s.player, window.keepPlayer);
    Vide.renderer.zoom = 1;
  });

  // Cité : deux villages dont les territoires se touchent fusionnent, et la cité se dessine.
  const cityCheck = await page.evaluate(() => {
    const s = Vide.game.state;
    const keep = { x: s.player.x, y: s.player.y };
    const mk = (type, x) => {
      s.player.x = x; s.player.y = -30000;
      const v = Vide.Villages.found(s, type);
      v.area = Math.PI * 350 * 350; v.cells = []; Vide.Territory.grow(v);
      return v;
    };
    mk('jardins', 0); mk('observatoire', 600);
    s.player.x = 300; s.player.y = -30000;
    window.keepPlayer = keep;
    return s.villages.length;
  });
  await page.waitForTimeout(2600);
  const city = await page.evaluate(() => {
    const s = Vide.game.state;
    const c = s.villages.find((v) => v.extra.length);
    const out = { n: s.villages.length, extra: c ? c.extra : null, districts: c ? c.districts.length : 0 };
    s.villages.splice(s.villages.indexOf(c), 1);
    Object.assign(s.player, window.keepPlayer);
    return out;
  });
  // (Le plus vaste absorbe l'autre : l'observatoire, qui grandit plus vite, garde son cœur.)
  check(city.n === cityCheck - 1 && city.extra && city.extra.length === 1 && city.districts === 1 && errors.length === 0,
    'deux villages qui se touchent deviennent une cité');

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

  // Zoom : la molette éloigne la caméra, + la rapproche ; le choix survit au rechargement.
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(100);
  const zoomed = await page.evaluate(() => Vide.renderer.zoom);
  await page.keyboard.press('+');
  await page.waitForTimeout(50);
  const zoomedIn = await page.evaluate(() => Vide.renderer.zoom);
  await page.reload();
  await wake();
  await page.waitForTimeout(300);
  const zoomKept = await page.evaluate(() => Vide.renderer.zoom);
  check(zoomed < 0.8 && zoomedIn > zoomed && Math.abs(zoomKept - zoomedIn) < 1e-9,
    `la molette et + règlent le zoom, gardé au rechargement (${zoomed.toFixed(2)} → ${zoomKept.toFixed(2)})`);
  await page.evaluate(() => { Vide.renderer.zoom = 1; Vide.Settings.set('zoom', 1); });

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
  const recoil = await page.evaluate(() => Vide.renderer.autoZoom);
  check(recoil < 0.9, `la caméra recule devant le colosse (${recoil.toFixed(2)})`);
  await page.evaluate(() => { const p = Vide.game.state.player; p.x = 0; p.y = 0; });

  // Absence : une sauvegarde vieille de 2 h fait grandir le territoire au rechargement.
  const radiusBefore = await page.evaluate(() => Vide.Territory.radius(Vide.game.state.villages[0]));
  await page.evaluate(() => {
    Vide.Storage.save(Vide.game.state);
    const save = JSON.parse(localStorage.getItem('le-vide/save'));
    save.savedAt -= 2 * 3600 * 1000;
    localStorage.setItem('le-vide/save', JSON.stringify(save));
    window.addEventListener('pagehide', (e) => e.stopImmediatePropagation(), { capture: true });
    Vide.Storage.readOnly = true; // empêche la sauvegarde de sortie d'écraser la sauvegarde vieillie
  });
  await page.reload();
  await wake();
  await page.waitForTimeout(300);
  const awayShown = await page.isVisible('#away');
  const radiusAfter = await page.evaluate(() => Vide.Territory.radius(Vide.game.state.villages[0]));
  check(awayShown && radiusAfter > radiusBefore + 20,
    `l’absence fait grandir le territoire (${Math.round(radiusBefore)} → ${Math.round(radiusAfter)}) et l’écran d’absence s’affiche`);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'absence.png') });
  await page.click('#away-close');
  check(!(await page.isVisible('#away')), 'l’écran d’absence se ferme');

  // Renaissance : après confirmation, la partie repart avec des souvenirs.
  await page.evaluate(() => { const st = Vide.game.state; st.totalLight += 9e6; });
  await page.waitForTimeout(200);
  await page.click('.tab:has-text("souvenirs")');
  page.once('dialog', (d) => d.accept());
  await page.click('#shop-list li:not([hidden]) .item:has-text("Renaissance")');
  await page.waitForTimeout(400);
  const life = await page.evaluate(() => ({ r: Vide.game.state.renaissances, m: Vide.game.state.memories, l: Vide.game.state.light }));
  check(life.r === 1 && life.m > 0 && (await page.isVisible('#memories')), `la renaissance (confirmée) donne des souvenirs (${life.m} ✧)`);

  // Menu : Échap l'ouvre et met le jeu en pause.
  await page.keyboard.press('Escape');
  const t0 = await page.evaluate(() => Vide.game.state.stats.playTime);
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => Vide.game.state.stats.playTime);
  const menuOpen = await page.isVisible('#menu');
  check(menuOpen && t1 === t0, 'Échap ouvre le menu et met en pause');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'menu.png') });

  // Options : secousses réduites, mémorisées.
  await page.click('#shake-toggle');
  const calm = await page.evaluate(() => ({ text: document.getElementById('shake-toggle').textContent, kept: Vide.Settings.get('reduceShake') }));
  check(calm.text.includes('réduites') && calm.kept === true, 'les secousses se réduisent depuis le menu');

  // Sauvegarde : exporter donne un code ; un code illisible est refusé ; un bon code remplace la partie.
  await page.click('.transfer summary');
  await page.click('#export-btn');
  const exported = await page.inputValue('#transfer-code');
  await page.fill('#transfer-code', 'n’importe quoi');
  await page.click('#import-btn');
  const refused = await page.textContent('#transfer-status');
  const code = await page.evaluate(() => {
    const st = JSON.parse(JSON.stringify(Vide.game.state));
    st.light = 12345;
    return Vide.Save.exportCode(st, Date.now());
  });
  await page.fill('#transfer-code', code);
  page.once('dialog', (d) => d.accept());
  await Promise.all([page.waitForNavigation(), page.click('#import-btn')]);
  await wake();
  await page.waitForTimeout(200);
  const importedLight = await page.evaluate(() => Vide.game.state.light);
  check(exported.startsWith('vide:') && refused.includes('illisible') && importedLight >= 12345 && importedLight < 13000,
    `exporter puis importer un code de sauvegarde (${Math.round(importedLight)} ✦)`);
  if (shotDir) {
    await page.keyboard.press('Escape');
    await page.click('.transfer summary');
    await page.click('#export-btn');
    await page.screenshot({ path: path.join(shotDir, 'menu-options.png') });
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('Escape');

  // Recommencer : confirmation, puis partie neuve, sans que la sauvegarde de sortie ne la réécrive.
  page.once('dialog', (d) => d.accept());
  await Promise.all([page.waitForNavigation(), page.click('#menu-reset')]);
  await page.waitForTimeout(300);
  const fresh = await page.evaluate(() => ({ total: Vide.game.state.totalLight, ups: Vide.game.state.upgrades }));
  check(fresh.total === 0 && Object.keys(fresh.ups).length === 0, 'recommencer efface la partie');
  await page.reload();
  await wake();
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
