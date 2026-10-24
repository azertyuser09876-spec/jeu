// Interface HTML par-dessus le canvas : compteur de lumière, boutique en onglets, pulsation.
// Les éléments n'apparaissent que lorsqu'ils deviennent utiles : au début, il n'y a que le vide.
(function (Vide) {
  'use strict';
  const { util, Catalog, Wallet } = Vide;

  const $ = (id) => document.getElementById(id);

  // N'écrit dans le DOM que si la valeur change : évite des recalculs de mise en page à chaque image.
  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }
  function setClass(el, cls, on) {
    if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
  }
  function setHidden(el, hidden) {
    if (el.hidden !== hidden) el.hidden = hidden;
  }

  function createRow(ui, item) {
    const li = document.createElement('li');
    li.hidden = true;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item';
    btn.title = item.desc;
    const part = (cls) => {
      const span = document.createElement('span');
      span.className = cls;
      btn.appendChild(span);
      return span;
    };
    const row = {
      item, li, btn,
      key: part('key'),
      name: part('name'),
      label: part('label'),
      effect: part('effect'),
      cost: part('cost'),
    };
    row.name.textContent = item.name;
    btn.addEventListener('click', () => buy(ui, item.id));
    li.appendChild(btn);
    ui.list.appendChild(li);
    return row;
  }

  function createTab(ui, tab) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.hidden = true;
    btn.textContent = tab.name;
    btn.addEventListener('click', () => { ui.activeTab = tab.id; });
    ui.tabsEl.appendChild(btn);
    return btn;
  }

  function create(game, hooks) {
    const ui = {
      game,
      hooks: hooks || {},
      intro: $('intro'),
      hud: $('hud'),
      amount: $('light-amount'),
      rate: $('rate-amount'),
      echoes: $('echoes'),
      echoAmount: $('echo-amount'),
      orders: $('orders'),
      orderButtons: [...document.querySelectorAll('#orders button')],
      shop: $('shop'),
      tabsEl: $('shop-tabs'),
      list: $('shop-list'),
      rows: [],
      tabs: new Map(),
      activeTab: Vide.TABS[0].id,
      pulseBtn: $('pulse-btn'),
      pulseRing: $('pulse-ring'),
      pulseShown: -1, // dernière progression affichée, pour éviter des écritures inutiles
    };
    for (const tab of Vide.TABS) ui.tabs.set(tab.id, createTab(ui, tab));
    for (const item of Catalog.all()) ui.rows.push(createRow(ui, item));
    for (const btn of ui.orderButtons) {
      btn.addEventListener('click', () => Vide.Combat.setPosture(game.state, btn.dataset.posture));
    }
    ui.pulseBtn.addEventListener('click', () => {
      if (ui.hooks.onPulse) ui.hooks.onPulse();
    });
    return ui;
  }

  function buy(ui, id) {
    if (!Catalog.buy(ui.game.state, id)) return false;
    const row = ui.rows.find((r) => r.item.id === id);
    // Relance l'animation d'achat même si on achète plusieurs fois de suite.
    row.btn.classList.remove('bought');
    void row.btn.offsetWidth;
    row.btn.classList.add('bought');
    ui.game.glow = 1;
    if (ui.hooks.onBuy) ui.hooks.onBuy(id);
    return true;
  }

  // Raccourcis clavier 1…9 : achète le n-ième article visible de l'onglet actif.
  function buyByIndex(ui, n) {
    const row = ui.rows.filter((r) => !r.li.hidden)[n - 1];
    return row ? buy(ui, row.item.id) : false;
  }

  // Touche Tab : onglet suivant parmi ceux disponibles.
  function nextTab(ui) {
    const tabs = Catalog.tabs(ui.game.state);
    if (tabs.length < 2) return false;
    const i = tabs.findIndex((t) => t.id === ui.activeTab);
    ui.activeTab = tabs[(i + 1) % tabs.length].id;
    return true;
  }

  const RING = 2 * Math.PI * 29; // périmètre de l'anneau SVG du bouton de pulsation

  function updatePulse(ui) {
    const { game } = ui;
    setClass(ui.pulseBtn, 'hidden', game.state.totalLight < 5);
    const progress = 1 - game.pulse.cooldown / game.pulse.duration;
    const shown = Math.round(util.clamp(progress, 0, 1) * 200) / 200;
    if (shown !== ui.pulseShown) {
      ui.pulseShown = shown;
      ui.pulseRing.style.strokeDashoffset = String(RING * (1 - shown));
    }
    setClass(ui.pulseBtn, 'ready', Vide.Sim.pulseReady(game));
  }

  function updateShop(ui) {
    const { state } = ui.game;
    const tabs = Catalog.tabs(state);
    if (tabs.length && !tabs.some((t) => t.id === ui.activeTab)) ui.activeTab = tabs[0].id;

    for (const [id, btn] of ui.tabs) {
      const available = tabs.some((t) => t.id === id);
      setHidden(btn, !available || tabs.length < 2);
      setClass(btn, 'active', id === ui.activeTab);
      // Un point signale un onglet inactif où un achat est possible.
      const buyable = available && id !== ui.activeTab &&
        Catalog.visible(state, id).some((item) => Catalog.canBuy(state, item.id));
      setClass(btn, 'notify', buyable);
    }

    let visible = 0;
    for (const row of ui.rows) {
      const { item } = row;
      const shown = item.tab === ui.activeTab && item.revealed(state);
      setHidden(row.li, !shown);
      if (!shown) continue;
      visible++;

      const maxed = item.maxed(state);
      const blocked = maxed ? null : item.blocked(state);
      setText(row.key, String(visible));
      setText(row.label, item.label(state));
      setText(row.effect, item.effect(state));
      setText(row.cost, maxed ? '' : blocked || Wallet.format(item.cost(state)));
      setClass(row.btn, 'affordable', Catalog.canBuy(state, item.id));
      setClass(row.btn, 'maxed', maxed);
      setClass(row.btn, 'blocked', Boolean(blocked));
    }
    setClass(ui.shop, 'hidden', tabs.length === 0);
  }

  function update(ui) {
    const { game } = ui;
    const { state } = game;

    // L'ouverture reste affichée jusqu'à la toute première particule récoltée.
    setClass(ui.intro, 'hidden', state.totalLight > 0);
    setClass(ui.hud, 'hidden', state.totalLight <= 0);
    setText(ui.amount, util.formatNumber(state.light));
    setText(ui.rate, util.formatRate(game.rate));
    setClass(ui.echoes, 'hidden', state.echoes <= 0 && state.stats.shadows === 0);
    setText(ui.echoAmount, util.formatNumber(state.echoes));
    setClass(ui.orders, 'hidden', Vide.Combat.armySize(state) === 0);
    for (const btn of ui.orderButtons) setClass(btn, 'active', btn.dataset.posture === state.army.posture);

    updateShop(ui);
    updatePulse(ui);
  }

  Vide.UI = { create, update, buy, buyByIndex, nextTab };
})(globalThis.Vide);
