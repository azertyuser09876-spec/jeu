// Écran « pendant ton absence… » et petits messages (toasts) au bas de l'écran.
(function (Vide) {
  'use strict';
  const { util } = Vide;
  const $ = (id) => document.getElementById(id);

  function formatDuration(seconds) {
    const s = Math.round(seconds);
    if (s < 60) return `${s} s`;
    const minutes = Math.floor(s / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
  }

  // --- Absence ---

  const away = { open: false };

  function show(report) {
    const lines = [];
    if (report.radiusAfter > report.radiusBefore) {
      lines.push(`Ton territoire s’est étendu : rayon ${Math.round(report.radiusBefore)} → ${Math.round(report.radiusAfter)}.`);
    }
    if (report.radiated > 0) lines.push(`Il a rayonné ✦ ${util.formatNumber(report.radiated)} de lumière.`);
    if (report.brought > 0) lines.push(`Tes êtres ont rapporté ✦ ${util.formatNumber(report.brought)} au foyer.`);
    if (report.built.length) {
      const names = report.built.map((type) => Vide.Structures.def(type).name.toLowerCase());
      lines.push(`Les bâtisseurs ont achevé : ${names.join(', ')}.`);
    }
    if (report.capped) {
      lines.push(`Le territoire ne se souvient que de ${formatDuration(report.applied)} (amélioration Mémoire).`);
    }

    $('away-duration').textContent = formatDuration(report.seconds);
    const list = $('away-lines');
    list.textContent = '';
    for (const text of lines) {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    }
    $('away').hidden = false;
    away.open = true;
  }

  function close() {
    $('away').hidden = true;
    away.open = false;
  }

  // --- Messages ---

  const MESSAGES = {
    foyer: 'Le foyer s’allume. Ton territoire grandira, même sans toi.',
    birth: (e) => (e.first ? FIRST_BIRTH[e.species] : null),
    built: (e) => `${Vide.Structures.def(e.building).name} achevé.`,
    tide: (e) => (e.first
      ? 'Une marée d’ombres approche, attirée par ton territoire. Ta pulsation peut les blesser.'
      : `Une marée d’ombres approche (${e.count}).`),
    shadowDown: (e) => (e.first ? 'Une ombre se dissipe et laisse un écho ◆. Les échos éveillent une armée.' : null),
    dispersed: (e) => `Ta lumière se disperse… et renaît au foyer. ✦ ${util.formatNumber(e.lost)} perdue.`,
    foyerAttacked: 'Des ombres rongent le foyer !',
    broken: (e) => `${Vide.Structures.def(e.building).name} s’éteint sous les ombres. Les bâtisseurs le répareront.`,
    repaired: (e) => `${Vide.Structures.def(e.building).name} brille de nouveau.`,
    heartbeat: (e) => Vide.Colossus.def(e.id).heartbeat,
    colossusFound: (e) => `Brise ses sceaux avec ta pulsation. Ton armée peut le faire plier.`,
    sealBroken: (e) => (e.left ? `Un sceau se brise. Encore ${e.left}.` : null),
    kneel: (e) => {
      const d = Vide.Colossus.def(e.id);
      return `${d.name} ${d.kneelText} ! Ses sceaux sont vulnérables.`;
    },
    web: () => (seen.web ? null : (seen.web = true, 'Une toile ! Elle ralentit tout ce qui s’y prend. Sors-en vite.')),
    colossusTamed: (e) => {
      const d = Vide.Colossus.def(e.id);
      return `${d.name} s’apaise. Il rejoint ton territoire. ${d.reward.text}`;
    },
    loreBatch: (e) => `Ton journal s’est rempli de ${e.count} fragments du récit (menu ≡).`,
    colossusLost: (e) => `${Vide.Colossus.def(e.id).name} se détourne et retourne à son repaire.`,
    beingDown: () => (seen.beingDown ? null : (seen.beingDown = true, 'Un être s’éteint… il se rallumera au foyer.')),
    // Les danses sont fréquentes : on n'en parle qu'une fois par session.
    dance: () => (seen.dance ? null : (seen.dance = true, 'Deux êtres se croisent… et dansent un instant ensemble.')),
  };

  const seen = {};

  // Message à la naissance du premier être de chaque espèce.
  const FIRST_BIRTH = {
    lueur: 'Une lueur s’éveille. Elle récoltera le jardin pour toi.',
    batisseur: 'Un bâtisseur s’éveille. Planifie un bâtiment : il choisira où le construire.',
    gardien: 'Un gardien s’éveille. Donne des ordres à l’armée : garder, escorter, chasser.',
    etincelle: 'Une étincelle s’éveille. Elle frappe les ombres de loin.',
    veilleuse: 'Une veilleuse s’éveille. Elle soignera les êtres et ta lumière.',
  };

  const toast = { queue: [], current: null, until: 0 };

  // Historique des derniers messages (utile aux tests et au débogage).
  const history = [];

  function notify(text, kind) {
    if (!text) return;
    toast.queue.push({ text, kind: kind || '' });
    // La file ne doit jamais déborder : les plus anciens messages ordinaires cèdent la place.
    if (toast.queue.length > 8) {
      const i = toast.queue.findIndex((m) => m.kind !== 'lore');
      toast.queue.splice(i >= 0 ? i : 0, 1);
    }
    history.push(text);
    if (history.length > 30) history.shift();
  }

  // Traduit les événements de la simulation en messages.
  // Bannière : un nom en grand (zone, colosse) et une ligne en dessous.
  function showTitle(name, sub, tint) {
    const el = $('zone-banner');
    $('zone-name').textContent = name;
    $('zone-desc').textContent = sub;
    el.style.setProperty('--zone', `rgb(${tint.join(',')})`);
    el.classList.remove('shown');
    void el.offsetWidth;
    el.classList.add('shown');
  }

  // Bannière de zone : son nom, et sa description à la première découverte.
  function showZone(id, discovered) {
    const zone = Vide.Zones.get(id);
    showTitle(zone.name, discovered ? zone.desc : '', zone.tint);
  }

  function readEvents(game) {
    const discovered = new Set(game.events.filter((e) => e.type === 'zoneDiscovered').map((e) => e.zone));
    for (const e of game.events) {
      if (e.type === 'zoneEnter') showZone(e.zone, discovered.has(e.zone));
      if (e.type === 'lore') notify(`« ${Vide.Lore.get(e.id).text} »`, 'lore');
      if (e.type === 'colossusFound') {
        const d = Vide.Colossus.def(e.id);
        showTitle(d.name, d.epithet, [255, 226, 160]);
      }
      const text = typeof MESSAGES[e.type] === 'function' ? MESSAGES[e.type](e) : MESSAGES[e.type];
      notify(text);
    }
    game.events.length = 0;
  }

  function updateToast(now) {
    const el = $('toast');
    if (toast.current && now < toast.until) return;
    if (toast.current) {
      toast.current = null;
      el.classList.remove('shown');
      toast.until = now + 600; // laisse le temps au fondu de sortie
      return;
    }
    if (now < toast.until || !toast.queue.length) return;
    toast.current = toast.queue.shift();
    el.textContent = toast.current.text;
    el.className = toast.current.kind;
    el.classList.add('shown');
    toast.until = now + 3500 + toast.current.text.length * (toast.current.kind === 'lore' ? 60 : 40);
  }

  function init() {
    $('away-close').addEventListener('click', close);
  }

  away.init = init;
  away.show = show;
  away.close = close;
  away.notify = notify;
  away.readEvents = readEvents;
  away.updateToast = updateToast;
  away.formatDuration = formatDuration;
  away.history = history;
  Vide.Away = away;
})(globalThis.Vide);
