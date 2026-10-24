// Mini cadre de test, utilisable dans le navigateur (tests.html) et dans node (run.js).
(function (root) {
  'use strict';
  const tests = [];

  function test(name, fn) {
    tests.push({ name, fn });
  }

  function show(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function fail(msg, detail) {
    throw new Error(msg ? `${msg} — ${detail}` : detail);
  }

  const assert = {
    ok(v, msg) {
      if (!v) fail(msg, `attendu vrai, obtenu ${show(v)}`);
    },
    equal(actual, expected, msg) {
      if (actual !== expected) fail(msg, `attendu ${show(expected)}, obtenu ${show(actual)}`);
    },
    near(actual, expected, eps, msg) {
      if (!(Math.abs(actual - expected) <= eps)) fail(msg, `attendu ${expected} ±${eps}, obtenu ${actual}`);
    },
    deepEqual(actual, expected, msg) {
      if (show(actual) !== show(expected)) fail(msg, `attendu ${show(expected)}, obtenu ${show(actual)}`);
    },
    throws(fn, msg) {
      try { fn(); } catch (e) { return; }
      fail(msg, 'une erreur était attendue');
    },
  };

  function run() {
    return tests.map(({ name, fn }) => {
      try {
        fn();
        return { name, ok: true };
      } catch (e) {
        return { name, ok: false, error: e && e.message ? e.message : String(e) };
      }
    });
  }

  root.VideTest = { test, assert, run };
})(globalThis);
