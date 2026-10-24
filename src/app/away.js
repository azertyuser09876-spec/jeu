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
  };

  // Message à la naissance du premier être de chaque espèce.
  const FIRST_BIRTH = {
    lueur: 'Une lueur s’éveille. Elle récoltera le jardin pour toi.',
  };

  const toast = { queue: [], current: null, until: 0 };

  function notify(text) {
    if (text) toast.queue.push(text);
  }

  // Traduit les événements de la simulation en messages.
  function readEvents(game) {
    for (const e of game.events) {
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
    el.textContent = toast.current;
    el.classList.add('shown');
    toast.until = now + 3500 + toast.current.length * 40;
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
  Vide.Away = away;
})(globalThis.Vide);
