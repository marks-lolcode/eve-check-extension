/* ========================================================================
   File: background.js — v2.6 — Last updated 2026-10-27
   Purpose:
     1) On toolbar click, inject a scanner into the active tab that reads the
        currently-selected system out of Aperture's Inspector panel.
     2) K-space: open an EVE Gatecheck tab routing that system to the
        destination hub chosen on the options page (default Jita).
     3) J-space: open a k162 tab for that system instead. Wormhole systems have
        no gates, so a Gatecheck route is meaningless for them. k162 keys on the
        EVE solar system id, which the Inspector does not render — it comes from
        the Intel panel's outbound links. See MAINTAINING.md.
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
     - Requires "activeTab", "scripting", "notifications" and "storage".
       "activeTab" grants host access to the clicked tab only, and only for
       that invocation — which is exactly this extension's shape, since every
       injection follows a toolbar click. It replaces "<all_urls>", so Chrome
       no longer warns that this extension can read every site you visit.
     - chrome.tabs.create() does NOT require the "tabs" permission; that one
       only unlocks sensitive tab fields (url, title, favIconUrl), which we
       never read. Adding it back would warn about browsing history for
       nothing.
     - Service worker logs: chrome://extensions/ → this extension → "service worker".
   ======================================================================== */

// The trade hubs offered on the options page. Duplicated in options.html's
// <select> and used here to validate what comes back out of storage — a value
// that is not on this list (stale sync data, hand-edited storage) must never
// reach the URL. If you add a hub, update options.html too.
const HUBS = ['Jita', 'Amarr', 'Dodixie', 'Hek', 'Rens'];
// Must match the first <option> in options.html, which options.js uses as its
// own fallback.
const DEFAULT_DESTINATION = 'Jita';

// Flip to true to trace every click in the service worker console. Off by
// default: the traces include the scanned system name.
const DEBUG = false;
const debug = (...args) => {
  if (DEBUG) console.log(...args);
};

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
 * Inspector panel. Returns { name } for a k-space system, { name, systemId }
 * for a J-space one, or { error } describing which failure case was hit.
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
  let aliasLabel = null;
  for (const s of panel.querySelectorAll('span')) {
    if (s.textContent.trim() === 'Alias') {
      aliasLabel = s;
      break;
    }
  }
  const aliasInput = aliasLabel?.parentElement?.querySelector('input[data-slot="input"]');
  const name = aliasInput?.placeholder?.trim();

  if (name) {
    // WHY an allowlist: the name comes from the page DOM and goes into the
    // Gatecheck URL fragment unencoded. A `#`, `:`, `/` or `?` would let the
    // page rewrite the route. EVE system names are letters, digits, hyphens,
    // spaces and apostrophes. Anything else is not a system.
    if (!/^[A-Za-z0-9' -]{1,40}$/.test(name)) {
      return { error: 'not-a-system' };
    }

    // WHAT: wormhole systems route to k162, not Gatecheck — J-codes (ordinary
    // wormholes and drifter systems) plus Thera, which is J-space with a
    // hand-given name rather than a J-code. Both are gateless, so Gatecheck has
    // nothing to route.
    // WHY here and not in the service worker: the solar system id lives in the
    // page, and this function is the only code that ever touches the page.
    if (/^J\d{6}$/.test(name) || name === 'Thera') {
      const intel = document
        .querySelector('button[aria-label="Hide Intel"]')
        ?.closest('.react-grid-item');

      // WHY the hrefs: the Intel panel renders region, constellation and
      // security as text, but never the solar system id — it appears only
      // inside its outbound links (zKill's path, EVEEYE's query string).
      // Aperture's own data-id is a row id and cannot be used here.
      // WHY parse the URL: an unanchored regex on the raw href would accept
      // `evil.com/zkillboard.com/system/1`. The page controls these links, so
      // pin the host and take only a bounded run of digits. Either site's link
      // works; the first one found wins.
      let systemId = null;
      for (const a of intel?.querySelectorAll('a') ?? []) {
        let url;
        try {
          url = new URL(a.href);
        } catch {
          continue;
        }
        const host = url.hostname.replace(/^www\./, '');
        let id = null;
        if (host === 'zkillboard.com') {
          id = url.pathname.match(/^\/system\/(\d{1,10})(?:\/|$)/)?.[1];
        } else if (host === 'eveeye.com') {
          id = url.searchParams.get('system');
        }
        if (id && /^\d{1,10}$/.test(id)) {
          systemId = id;
          break;
        }
      }

      return systemId ? { name, systemId } : { error: 'no-intel' };
    }

    return { name };
  }

  // WHY no fallback to the panel's card-title: it renders a connection/note
  // heading for those selections, and nothing defines it as a name field — at
  // rc.14 it held the real name for an aliased system, but that is incidental,
  // not a contract. Either way it can hand back a name that is not a system,
  // and we would open a bogus route rather than saying so. The Alias
  // placeholder is the only field defined to hold the real name, so its
  // absence is a hard failure.
  const empty = panel.textContent.includes('Select a system, connection, or note');
  return { error: empty ? 'no-selection' : 'not-a-system' };
}

const ERROR_MESSAGES = {
  'no-panel':
    "Aperture's Inspector panel is hidden. Show it in Aperture via Panels -> Inspector, then select a system.",
  'no-selection': 'No system selected. Click a system on the map, then try again.',
  'not-a-system': 'That selection is not a system. Click a system on the map, then try again.',
  'no-intel':
    "Wormhole systems need Aperture's Intel panel — it carries the system id k162 needs. Show it in Aperture via Panels -> Intel, then try again."
};

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: 'EVE Gatecheck Linker',
    message
  });
}

// WHY no encodeURIComponent on the name: readSelectedSystem has already limited
// it to letters, digits, hyphens, spaces and apostrophes, and Gatecheck reads
// the fragment as plain text. `destination` is checked against HUBS.
function openGatecheck(systemName, destination) {
  const gatecheckUrl = `https://eve-gatecheck.space/eve/#${systemName}:${destination}:shortest`;

  openTab(gatecheckUrl, 'Gatecheck');
}

function openK162(systemId) {
  openTab(`https://k-162.space/?system=${encodeURIComponent(systemId)}`, 'k162');
}

function openTab(url, label) {
  debug(`[background] Opening ${label}:`, url);
  chrome.tabs.create({ url }, (tab) => {
    if (chrome.runtime.lastError) {
      console.error(`[background] tabs.create (${label}) error:`, chrome.runtime.lastError);
    } else {
      debug(`[background] ${label} tab created with id:`, tab?.id);
    }
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  debug('[background] action.onClicked: injecting scanner into tab', tab?.id);

  let results;
  let destination;
  try {
    // The storage read does not depend on the scan, so run them together.
    // getDestination() never rejects, so only executeScript can throw here.
    [results, destination] = await Promise.all([
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readSelectedSystem
      }),
      getDestination()
    ]);
  } catch (err) {
    console.error('[background] executeScript failed:', err);
    notify('Could not read the page. Is this an Aperture map tab?');
    return;
  }

  // The result is structured-clone data from the page's context: check its
  // shape rather than trusting it.
  const result = results?.[0]?.result;
  debug('[background] Scanner returned:', result);

  if (typeof result?.systemId === 'string' && /^\d{1,10}$/.test(result.systemId)) {
    openK162(result.systemId);
    return;
  }

  if (typeof result?.name === 'string' && result.name) {
    openGatecheck(result.name, destination);
    return;
  }

  // A null or malformed scanner result has no `error` key and lands on the
  // generic message.
  const message = ERROR_MESSAGES[result?.error] ?? 'Could not find a selected system.';
  console.warn('[background] No system read:', result?.error);
  notify(message);
});

/* ============================== End of file: background.js ============================== */
