// Interface HTML par-dessus le canvas : compteur de lumière et améliorations.
// Les éléments n'apparaissent que lorsqu'ils deviennent utiles : au début, il n'y a que le vide.
(function (Vide) {
  'use strict';
  const { util, Economy } = Vide;

  const $ = (id) => document.getElementById(id);

  // N'écrit dans le DOM que si la valeur change : évite des recalculs de mise en page à chaque image.
  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }
  function setClass(el, cls, on) {
    if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
  }

  function createRow(ui, up) {
    const li = document.createElement('li');
    li.hidden = true;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'upgrade';
    btn.title = up.desc;
    const part = (cls) => {
      const span = document.createElement('span');
      span.className = cls;
      btn.appendChild(span);
      return span;
    };
    const row = {
      up, li, btn,
      key: part('key'),
      name: part('name'),
      level: part('level'),
      effect: part('effect'),
      cost: part('cost'),
    };
    row.name.textContent = up.name;
    btn.addEventListener('click', () => buy(ui, up.id));
    li.appendChild(btn);
    ui.list.appendChild(li);
    return row;
  }

  function create(game, hooks) {
    const ui = {
      game,
      hooks: hooks || {},
      intro: $('intro'),
      hud: $('hud'),
      amount: $('light-amount'),
      rate: $('rate-amount'),
      panel: $('upgrades'),
      list: $('upgrade-list'),
      rows: [],
      pulseBtn: $('pulse-btn'),
      pulseRing: $('pulse-ring'),
      pulseShown: -1, // dernière progression affichée, pour éviter des écritures inutiles
    };
    for (const up of Vide.UPGRADES) ui.rows.push(createRow(ui, up));
    ui.pulseBtn.addEventListener('click', () => {
      if (ui.hooks.onPulse) ui.hooks.onPulse();
    });
    return ui;
  }

  const RING = 2 * Math.PI * 29; // périmètre de l'anneau SVG du bouton de pulsation

  function updatePulse(ui) {
    const { game } = ui;
    setClass(ui.pulseBtn, 'hidden', game.state.totalLight < 5);
    const progress = 1 - game.pulse.cooldown / game.stats.pulseCooldown;
    const shown = Math.round(progress * 200) / 200;
    if (shown !== ui.pulseShown) {
      ui.pulseShown = shown;
      ui.pulseRing.style.strokeDashoffset = String(RING * (1 - shown));
    }
    setClass(ui.pulseBtn, 'ready', Vide.Sim.pulseReady(game));
  }

  function buy(ui, id) {
    if (!Economy.buy(ui.game.state, id)) return false;
    const row = ui.rows.find((r) => r.up.id === id);
    // Relance l'animation d'achat même si on achète plusieurs fois de suite.
    row.btn.classList.remove('bought');
    void row.btn.offsetWidth;
    row.btn.classList.add('bought');
    ui.game.glow = 1;
    if (ui.hooks.onBuy) ui.hooks.onBuy(id);
    return true;
  }

  // Raccourcis clavier 1…9 : achète la n-ième amélioration visible.
  function buyByIndex(ui, n) {
    const row = ui.rows.filter((r) => !r.li.hidden)[n - 1];
    return row ? buy(ui, row.up.id) : false;
  }

  function update(ui) {
    const { game } = ui;
    const { state } = game;

    // L'ouverture reste affichée jusqu'à la toute première particule récoltée.
    setClass(ui.intro, 'hidden', state.totalLight > 0);
    setClass(ui.hud, 'hidden', state.totalLight <= 0);
    setText(ui.amount, util.formatNumber(state.light));
    setText(ui.rate, util.formatRate(game.rate));

    let visible = 0;
    for (const row of ui.rows) {
      const id = row.up.id;
      const revealed = Economy.isRevealed(state, id);
      if (row.li.hidden === revealed) row.li.hidden = !revealed;
      if (!revealed) continue;
      visible++;

      const maxed = Economy.isMaxed(state, id);
      const level = Economy.level(state, id);
      const preview = Economy.preview(state, id);
      setText(row.key, String(visible));
      setText(row.level, maxed ? 'max' : level ? `niv. ${level}` : '');
      setText(row.effect, preview.next ? `${preview.now} → ${preview.next}` : preview.now);
      setText(row.cost, maxed ? '' : '✦ ' + util.formatNumber(Economy.nextCost(state, id)));
      setClass(row.btn, 'affordable', Economy.canBuy(state, id));
      setClass(row.btn, 'maxed', maxed);
    }
    setClass(ui.panel, 'hidden', visible === 0);
    updatePulse(ui);
  }

  Vide.UI = { create, update, buy, buyByIndex };
})(globalThis.Vide);
