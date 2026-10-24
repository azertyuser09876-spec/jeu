(function () {
  'use strict';
  const { test, assert } = VideTest;
  const { clamp, damp, rng, hash2, formatNumber, formatRate } = Vide.util;

  test('clamp borne une valeur', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
  });

  test('damp ne dépend pas du découpage du temps', () => {
    // Deux pas de 0,5 s doivent donner le même résultat qu'un pas de 1 s.
    const oneStep = damp(3, 1);
    const half = damp(3, 0.5);
    const twoSteps = half + (1 - half) * half;
    assert.near(twoSteps, oneStep, 1e-9);
  });

  test('rng est déterministe et reste dans [0, 1)', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      assert.equal(v, b());
      assert.ok(v >= 0 && v < 1);
    }
  });

  test('rng.range respecte ses bornes', () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-5, 5);
      assert.ok(v >= -5 && v < 5);
    }
  });

  test('hash2 est stable et varie selon la cellule', () => {
    assert.equal(hash2(3, -4, 1), hash2(3, -4, 1));
    assert.ok(hash2(3, -4, 1) !== hash2(4, -4, 1));
    assert.ok(hash2(3, -4, 1) !== hash2(3, -4, 2));
  });

  test('formatNumber : petits nombres arrondis vers le bas', () => {
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(7.9), '7');
    assert.equal(formatNumber(999), '999');
  });

  test('formatNumber : suffixes et virgule française', () => {
    assert.equal(formatNumber(1234), '1,23k');
    assert.equal(formatNumber(45600), '45,6k');
    assert.equal(formatNumber(123456), '123k');
    assert.equal(formatNumber(2.5e6), '2,50M');
  });

  test("formatNumber : l'arrondi ne produit jamais 1000k", () => {
    assert.equal(formatNumber(999999), '1,00M');
  });

  test('formatNumber : très grands nombres et infini', () => {
    assert.ok(formatNumber(1e40).includes('e40'));
    assert.equal(formatNumber(Infinity), '∞');
  });

  test('formatRate : une décimale sous 10', () => {
    assert.equal(formatRate(0), '0,0');
    assert.equal(formatRate(3.46), '3,5');
    assert.equal(formatRate(1500), '1,50k');
  });
})();
