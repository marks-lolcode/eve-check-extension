/* ========================================================================
   File: options.js — v1.1 — Last updated 2026-10-27
   Purpose:
     Read/write the route destination hub in chrome.storage.sync under the key
     "destination". background.js reads the same key when building the Gatecheck
     URL, and falls back to Jita if it is unset or unrecognised.
   Notes:
     - The hub list is duplicated in background.js (HUBS) and in the <select>
       in options.html. A service worker cannot share a plain const with a page
       script without a build step or ES modules, and the list rarely changes.
       If you add a hub, update HUBS in background.js and the <select> in
       options.html.
     - Saving is immediate on change (debounced); there is no Save button.
   ======================================================================== */

const select = document.getElementById('destination');
const status = document.getElementById('status');

// The first <option> is the default. background.js keeps its own copy of the
// same value; keep the two in step.
const DEFAULT_DESTINATION = select.options[0].value;

// sync allows roughly 120 writes a minute, and arrow-keying through the
// dropdown fires a change event per step. Wait for the user to settle.
const SAVE_DELAY_MS = 300;

let statusTimer;
let saveTimer;
let savedValue;

function showStatus(message) {
  status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

// WHY validate against the <select>'s own options: storage is shared across
// versions and profiles. A value written by a future build (or hand-edited)
// would otherwise leave the dropdown blank while the extension kept routing
// somewhere the user cannot see.
function isKnownHub(value) {
  return Array.prototype.some.call(select.options, (option) => option.value === value);
}

async function restore() {
  try {
    const { destination } = await chrome.storage.sync.get('destination');
    savedValue = isKnownHub(destination) ? destination : DEFAULT_DESTINATION;
    select.value = savedValue;
  } catch (err) {
    console.error('[options] storage.sync.get failed:', err);
    select.value = DEFAULT_DESTINATION;
    showStatus('Could not read your setting. Showing the default.');
  }
}

async function commit() {
  const destination = select.value;
  if (destination === savedValue) return;

  try {
    await chrome.storage.sync.set({ destination });
    savedValue = destination;
    showStatus(`Saved — routing to ${destination}.`);
  } catch (err) {
    console.error('[options] storage.sync.set failed:', err);
    showStatus('Could not save. Try again.');
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(commit, SAVE_DELAY_MS);
}

select.addEventListener('change', save);

// Follow edits made elsewhere (a second options page, another synced device) so
// this page never shows a stale hub.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.destination) return;
  const next = changes.destination.newValue;
  if (isKnownHub(next)) {
    savedValue = next;
    select.value = next;
  }
});

// The script tag sits at the end of <body>, so the elements above already exist
// and there is nothing to wait for.
restore();

/* ============================== End of file: options.js ============================== */
