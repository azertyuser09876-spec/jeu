// Petits outils mathématiques et d'affichage, sans dépendance au navigateur.
(function (Vide) {
  'use strict';

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Fraction à parcourir pendant dt pour un lissage indépendant du nombre d'images par seconde.
  function damp(rate, dt) {
    return 1 - Math.exp(-rate * dt);
  }

  // Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même suite.
  function rng(seed) {
    let s = seed >>> 0;
    const next = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = function (min, max) { return min + next() * (max - min); };
    return next;
  }

  // Valeur pseudo-aléatoire stable dans [0, 1) pour une cellule (x, y) : sert au décor généré.
  function hash2(x, y, seed) {
    let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const SUFFIXES = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];

  // 999 → "999", 1234 → "1,23k", 45600 → "45,6k", 1e6 → "1,00M".
  function formatNumber(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + formatNumber(-n);
    if (n < 1000) return String(Math.floor(n));
    let tier = Math.floor(Math.log10(n) / 3);
    let scaled = n / Math.pow(1000, tier);
    let decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    // L'arrondi peut produire "1000k" : on passe alors au palier suivant.
    if (Number(scaled.toFixed(decimals)) >= 1000) {
      tier++;
      scaled /= 1000;
      decimals = 2;
    }
    if (tier >= SUFFIXES.length) return n.toExponential(2).replace('.', ',').replace('+', '');
    return scaled.toFixed(decimals).replace('.', ',') + SUFFIXES[tier];
  }

  // Débit par seconde : une décimale pour les petites valeurs.
  function formatRate(n) {
    if (n < 10) return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
    return formatNumber(n);
  }

  // Multiplicateur : "×1,40", "×12,5", "×340", "×1,20k".
  function formatMultiplier(n) {
    if (n >= 1000) return '×' + formatNumber(n);
    const decimals = n < 10 ? 2 : n < 100 ? 1 : 0;
    return '×' + n.toFixed(decimals).replace('.', ',');
  }

  Vide.util = { clamp, lerp, damp, rng, hash2, formatNumber, formatRate, formatMultiplier };
})(globalThis.Vide);
