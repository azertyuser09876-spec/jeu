// Lance les tests dans node : `node tests/run.js`.
// La liste des fichiers est lue dans tests.html, pour n'avoir qu'une seule source de vérité.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'tests.html'), 'utf8');
const files = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((m) => m[1])
  .filter((src) => !src.endsWith('browser.js'));

const context = vm.createContext({ console });
for (const src of files) {
  const file = path.resolve(__dirname, src);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const results = context.VideTest.run();
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`✗ ${r.name}\n    ${r.error}`);
console.log(`${results.length - failed.length}/${results.length} tests réussis`);
process.exitCode = failed.length ? 1 : 0;
