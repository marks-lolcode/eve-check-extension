// tests/scanner.test.js — v1.1 — Last updated 2026-07-26
//
// Tests readSelectedSystem() from background.js against fixtures rebuilt from
// real Aperture v1.0.0-rc.14 DOM dumps.
//
// The case that matters: an ALIASED system must still resolve to its real name.
// Aperture's map node shows only the alias, so a regression here is invisible
// in normal use and produces a 404 Gatecheck URL. See MAINTAINING.md.
//
// Run: npm test

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// WHY extract from background.js rather than copy the function here: a copy
// drifts, and a drifted copy tests nothing. background.js is a plain service
// worker script with no module exports, so slicing the source is the cheapest
// way to test the code that actually ships.
//
// The new Function() below will trip code-injection linters. It is safe here and
// only here: the input is background.js read from this repo off local disk — the
// same trust level as this test file itself — never user or network input. Do not
// copy this pattern into the extension.
const backgroundPath = path.join(__dirname, '..', 'background.js');
const src = fs.readFileSync(backgroundPath, 'utf8');
const start = src.indexOf('function readSelectedSystem()');
const end = src.indexOf('const ERROR_MESSAGES');
if (start === -1 || end === -1) {
  throw new Error(
    'Could not extract readSelectedSystem from background.js. If you renamed it ' +
      'or moved ERROR_MESSAGES, update the markers in this file.'
  );
}
const readSelectedSystem = new Function(src.slice(start, end) + '; return readSelectedSystem;')();

// --- Fixtures ---------------------------------------------------------------

// Inspector with a system selected. `placeholder` is the real name, `value` is
// the alias — that separation is the whole basis of the scanner.
const inspectorWith = (aliasValue, placeholder, title) => `
<div class="react-grid-item react-draggable cssTransforms react-resizable">
  <div data-slot="card">
    <div class="ap-panel-drag">
      <div class="nodrag"><span><button type="button" class="truncate font-heading" aria-current="true">Inspector</button></span></div>
      <div class="nodrag ml-auto flex items-center gap-1">
        <button type="button" data-slot="button" aria-label="Hide Inspector"></button>
      </div>
    </div>
    <div data-slot="card" data-size="sm">
      <div data-slot="card-header">
        <div data-slot="card-title" class="font-heading">${title}</div>
      </div>
      <div data-slot="card-content" class="flex flex-col gap-2 text-xs">
        <div class="flex flex-col gap-1">
          <span class="text-[10px] text-muted-foreground">Status</span>
          <button role="combobox" data-slot="select-trigger"><span data-slot="select-value">unknown</span></button>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] text-muted-foreground">Alias</span>
          <input data-slot="input" placeholder="${placeholder}" class="h-7" value="${aliasValue}">
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[10px] text-muted-foreground">Tag</span>
          <input data-slot="input" placeholder="—" maxlength="50" class="h-7" value="">
        </div>
      </div>
    </div>
  </div>
</div>`;

// Nothing selected — verbatim empty state.
const inspectorEmpty = `
<div class="react-grid-item">
  <div class="ap-panel-drag">
    <div class="nodrag ml-auto flex items-center gap-1">
      <button type="button" data-slot="button" aria-label="Hide Inspector"></button>
    </div>
  </div>
  <div data-slot="card" data-size="default">
    <div data-slot="card-content" class="text-xs text-muted-foreground">Select a system, connection, or note to edit.</div>
  </div>
</div>`;

// A connection selected. Deliberately HAS a card-title: this is the fixture that
// proves we must not fall back to it — doing so would return "J123456 ↔ OOPS"
// as if it were a system name.
const inspectorConnection = `
<div class="react-grid-item">
  <div class="ap-panel-drag">
    <div class="nodrag ml-auto flex items-center gap-1">
      <button type="button" data-slot="button" aria-label="Hide Inspector"></button>
    </div>
  </div>
  <div data-slot="card" data-size="sm">
    <div data-slot="card-header">
      <div data-slot="card-title" class="font-heading">J123456 &harr; OOPS</div>
    </div>
    <div data-slot="card-content" class="flex flex-col gap-2 text-xs">
      <div class="flex flex-col gap-1">
        <span class="text-[10px] text-muted-foreground">Mass</span>
        <button role="combobox" data-slot="select-trigger"><span data-slot="select-value">stable</span></button>
      </div>
    </div>
  </div>
</div>`;

// Real panels that also contain placeholder inputs, rendered BEFORE the Inspector
// just as they are on the real page. Without scoping, a bare input[placeholder]
// query returns "Start system…" instead of the system name.
const decoyPanels = `
<div class="react-grid-item">
  <div class="ap-panel-drag"><button aria-label="Hide Routes"></button></div>
  <input data-slot="input" placeholder="Start system…" value="">
  <input data-slot="input" placeholder="Add destination…" value="">
</div>
<div class="react-grid-item">
  <div class="ap-panel-drag"><button aria-label="Hide Signature Search"></button></div>
  <label class="text-xs font-medium text-muted-foreground">Name</label>
  <input data-slot="input" placeholder="Search…" value="">
</div>`;

// --- Runner -----------------------------------------------------------------

const results = [];

function run(name, bodyHtml, expected) {
  const dom = new JSDOM(`<body>${bodyHtml}</body>`);
  global.document = dom.window.document;

  let got;
  try {
    got = readSelectedSystem();
  } catch (err) {
    got = { threw: String(err) };
  }

  const ok = JSON.stringify(got) === JSON.stringify(expected);
  results.push(ok);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}` +
      (ok ? '' : `\n      got      ${JSON.stringify(got)}\n      expected ${JSON.stringify(expected)}`)
  );
}

run(
  'no alias set -> real name from placeholder',
  decoyPanels + inspectorWith('', 'Perimeter', 'Perimeter'),
  { name: 'Perimeter' }
);

run(
  'ALIASED "OOPS" -> still returns Perimeter (the regression this guards)',
  decoyPanels + inspectorWith('OOPS', 'Perimeter', 'OOPS'),
  { name: 'Perimeter' }
);

// WHY a second aliased case: J-code names look nothing like the k-space name
// above, and an alias hides that difference completely. This is the shape the
// scanner will meet most often in wormhole space.
run(
  'J-code system aliased "Backdoor" -> returns J123456',
  decoyPanels + inspectorWith('Backdoor', 'J123456', 'Backdoor'),
  { name: 'J123456' }
);

run('nothing selected -> no-selection', decoyPanels + inspectorEmpty, { error: 'no-selection' });

run('connection selected -> not-a-system (must not use card-title)', decoyPanels + inspectorConnection, {
  error: 'not-a-system'
});

run('Inspector panel hidden -> no-panel', decoyPanels, { error: 'no-panel' });

run('empty page -> no-panel', '', { error: 'no-panel' });

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
