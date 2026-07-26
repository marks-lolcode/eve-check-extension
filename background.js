/* ========================================================================
   File: background.js — v2.2.1 — Last updated 2026-07-26
   Purpose:
     1) On toolbar click, inject a scanner into the active tab that reads the
        currently-selected system out of Aperture's Inspector panel.
     2) Open an EVE Gatecheck tab routing that system to the destination hub
        chosen on the options page (default Jita).
   Why the Inspector, and not the map node:
     - Aperture's map node shows the system's ALIAS. Setting an alias replaces
       the real name in the node entirely, and the real name then appears
       nowhere else in the document — so a node-based scanner silently emits
       a bogus URL.
     - The Inspector's Alias input keeps them separate: `value` is the alias,
       `placeholder` is the real system name. The placeholder is the only
       alias-proof source, and it renders only for the selected system.
   ------------------------------------------------------------------------
   Notes:
     - chrome.tabs.create() requires the property name "url". Using any other
       key throws "Unexpected property".
     - Requires "scripting", "tabs", "notifications" and "storage" permissions.
     - Service worker logs: chrome://extensions/ → this extension → "service worker".
   ======================================================================== */

// The trade hubs offered on the options page. Duplicated in options.html's
// <select> and used here to validate what comes back out of storage — a value
// that is not on this list (stale sync data, hand-edited storage) must never
// reach the URL. If you add a hub, update options.html too.
const HUBS = ['Jita', 'Amarr', 'Dodixie', 'Hek', 'Rens'];
const DEFAULT_DESTINATION = 'Jita';

async function getDestination() {
  try {
    const { destination } = await chrome.storage.sync.get('destination');
    return HUBS.includes(destination) ? destination : DEFAULT_DESTINATION;
  } catch (err) {
    console.error('[background] storage.sync.get failed; using default:', err);
    return DEFAULT_DESTINATION;
  }
}

/**
 * Runs in the page. Reads the selected system's real name from Aperture's
 * Inspector panel. Returns { name } on success, or { error } describing which
 * failure case was hit.
 */
function readSelectedSystem() {
  // WHY: anchor on the panel's hide button — its aria-label is stable, while
  // the panel's Tailwind classes and generated base-ui ids are not.
  const panel = document
    .querySelector('button[aria-label="Hide Inspector"]')
    ?.closest('.react-grid-item');

  if (!panel) {
    return { error: 'no-panel' };
  }

  // WHAT: the "Alias" label span shares a flex wrapper with its input.
  // WHY: scoping matters — a loose input[placeholder] query would match the
  // Routes "Start system…" field or the Inspector's own Tag input ("—").
  const aliasLabel = [...panel.querySelectorAll('span')].find(
    (s) => s.textContent.trim() === 'Alias'
  );
  const aliasInput = aliasLabel?.parentElement?.querySelector('input[data-slot="input"]');
  const name = aliasInput?.placeholder?.trim();

  if (name) {
    return { name };
  }

  // WHY no fallback to the panel's card-title: it renders the ALIAS for an
  // aliased system, and renders a connection/note heading for those selections.
  // Either would hand back a name that is not a system, and we would open a
  // bogus route rather than saying so. The Alias placeholder is the only field
  // that is defined to hold the real name, so its absence is a hard failure.
  const empty = panel.textContent.includes('Select a system, connection, or note');
  return { error: empty ? 'no-selection' : 'not-a-system' };
}

const ERROR_MESSAGES = {
  'no-panel':
    "Aperture's Inspector panel is hidden. Show it in Aperture via Panels -> Inspector, then select a system.",
  'no-selection': 'No system selected. Click a system on the map, then try again.',
  'not-a-system': 'That selection is not a system. Click a system on the map, then try again.'
};

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: 'EVE Gatecheck Linker',
    message
  });
}

async function openGatecheck(systemName) {
  const system = String(systemName).trim();
  const destination = await getDestination();
  const gatecheckUrl = `https://eve-gatecheck.space/eve/#${system}:${destination}:shortest`;

  console.log('[background] Opening Gatecheck:', gatecheckUrl);
  chrome.tabs.create({ url: gatecheckUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('[background] tabs.create (Gatecheck) error:', chrome.runtime.lastError);
    } else {
      console.log('[background] Gatecheck tab created with id:', tab?.id);
    }
  });
}

chrome.action.onClicked.addListener((tab) => {
  console.log('[background] action.onClicked: injecting scanner into tab', tab?.id);

  try {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: readSelectedSystem
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.error('[background] executeScript failed:', chrome.runtime.lastError);
          notify('Could not read the page. Is this an Aperture map tab?');
          return;
        }

        const result = results?.[0]?.result;
        console.log('[background] Scanner returned:', result);

        if (result?.name) {
          openGatecheck(result.name);
          return;
        }

        const message = ERROR_MESSAGES[result?.error] ?? 'Could not find a selected system.';
        console.warn('[background] No system read:', result?.error);
        notify(message);
      }
    );
  } catch (err) {
    console.error('[background] Unexpected error during injection:', err);
  }
});

/* ============================== End of file: background.js ============================== */
