// Affiche les résultats des tests dans tests.html.
(function () {
  'use strict';
  const results = VideTest.run();
  const failed = results.filter((r) => !r.ok);
  const out = document.getElementById('results');
  document.getElementById('summary').textContent =
    `${results.length - failed.length}/${results.length} tests réussis`;
  document.body.classList.add(failed.length ? 'fail' : 'pass');
  for (const r of results) {
    const li = document.createElement('li');
    li.className = r.ok ? 'ok' : 'ko';
    li.textContent = (r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : ` — ${r.error}`);
    out.appendChild(li);
  }
})();
