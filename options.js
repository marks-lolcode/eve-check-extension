/* ========================================================================
   File: options.js — v1.0 — Last updated 2026-07-26
   Purpose:
     Read/write the route destination hub in chrome.storage.sync under the key
     "destination". background.js reads the same key when building the Gatecheck
     URL, and falls back to Jita if it is unset or unrecognised.
   Notes:
     - The hub list is duplicated in background.js (HUBS) and in the <select>
       in options.html. A service worker cannot share a plain const with a page
       script without a build step or ES modules, and this list changes about
       once never. If you add a hub, update all three.
     - Saving is immediate on change; there is no Save button.
   ======================================================================== */

const DEFAULT_DESTINATION = 'Jita';

const select = document.getElementById('destination');
const status = document.getElementById('status');

let statusTimer;

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
  return [...select.options].some((option) => option.value === value);
}

async function restore() {
  try {
    const { destination } = await chrome.storage.sync.get('destination');
    select.value = isKnownHub(destination) ? destination : DEFAULT_DESTINATION;
  } catch (err) {
    console.error('[options] storage.sync.get failed:', err);
    select.value = DEFAULT_DESTINATION;
    showStatus('Could not read your setting. Showing the default.');
  }
}

async function save() {
  const destination = select.value;

  try {
    await chrome.storage.sync.set({ destination });
    showStatus(`Saved — routing to ${destination}.`);
  } catch (err) {
    console.error('[options] storage.sync.set failed:', err);
    showStatus('Could not save. Try again.');
  }
}

select.addEventListener('change', save);

// The script tag sits at the end of <body>, so the elements above already exist
// and there is nothing to wait for.
restore();

/* ============================== End of file: options.js ============================== */
