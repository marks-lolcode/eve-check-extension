/* ========================================================================
   File: background.js
   Purpose:
     1) On toolbar click, inject a scanner into the active tab to find the
        first system with tag "Static" and security "HS", then send its
        name back to this background service worker.
     2) When a { systemName } message is received, open TWO tabs:
          - EVE Gatecheck
          - EVE Navigator
   Why:
     - chrome.tabs.create() requires the property name "url". Using "urlGC"
       (or any other key) will throw "Unexpected property" errors.
     - We log every step to make debugging straightforward in the
       Extensions > Service Worker console.
   ------------------------------------------------------------------------
   Notes:
     - Manifest V3 service worker logs are visible at:
       chrome://extensions/  → your extension → "service worker" link.
     - This script assumes "tabs" and "scripting" permissions exist
       in manifest.json.
   ======================================================================== */

chrome.action.onClicked.addListener((tab) => {
  // Why: When the user clicks the toolbar button, we run a scanner in the current page
  // to find the first matching system and message it back here.
  console.log('[background] action.onClicked: injecting scanner into tab', tab?.id);

  try {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // This function runs in the page. We keep it simple: look for systems,
        // pick the first Static + HS match, and message the background.
        console.log('[content-injected] Scanner start');

        const systems = document.querySelectorAll('.pf-system');
        console.log(`[content-injected] Found ${systems.length} systems`);

        for (let system of systems) {
          const nameEl = system.querySelector('.pf-system-head-name');
          const tagEl  = system.querySelector('.pf-system-head-tag');
          const secEl  = system.querySelector('.pf-system-sec');

          // WHAT: We try both data-* and textContent paths to be resilient.
          // WHY: DOMs differ; we want a value even if dataset is missing.
          const rawName = nameEl?.dataset?.value || nameEl?.textContent?.trim();
          const tag     = tagEl?.dataset?.value  || tagEl?.textContent?.trim();
          const sec     = secEl?.dataset?.value  || secEl?.textContent?.trim();

          // Optional: Some names may have trailing bits; keep first token only.
          const name = rawName?.split(/\s+/)[0];

          console.log(`[content-injected] Check → name="${name}", tag="${tag}", sec="${sec}"`);

          if (name && tag === 'Static' && sec === 'HS') {
            console.log('[content-injected] Match found; sending message to background:', name);
            chrome.runtime.sendMessage({ systemName: name });
            break;
          }
        }

        console.log('[content-injected] Scanner done');
      }
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[background] executeScript failed:', chrome.runtime.lastError);
      } else {
        console.log('[background] executeScript completed');
      }
    });
  } catch (err) {
    console.error('[background] Unexpected error during injection:', err);
  }
});

// Receive { systemName } from injected/content script and open two tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[background] onMessage received:', message);

  try {
    if (!message || !message.systemName) {
      console.warn('[background] Missing "systemName" in message; ignoring.');
      return; // Nothing to do
    }

    // WHAT: Normalize the system name for safety; encode where needed.
    // WHY: Prevents odd characters from breaking URLs.
    const system = String(message.systemName).trim();

    // Build both URLs. Keep the key "url" in chrome.tabs.create.
    const gatecheckUrl = `https://eve-gatecheck.space/eve/#${system}:Jita:shortest`;
    // If you truly want a fixed origin (e.g., Ichinumi), hard-code it here.
    // Otherwise, use the detected system as the origin for Navigator too:
    const navigatorUrl = `https://navigator.contrum.space/?from=${encodeURIComponent(system)}&to=Jita&order=true&autoSearch=true`;

    console.log('[background] Opening Gatecheck:', gatecheckUrl);
    chrome.tabs.create({ url: gatecheckUrl }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('[background] tabs.create (Gatecheck) error:', chrome.runtime.lastError);
      } else {
        console.log('[background] Gatecheck tab created with id:', tab?.id);
      }
    });

    console.log('[background] Opening Navigator:', navigatorUrl);
    chrome.tabs.create({ url: navigatorUrl }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('[background] tabs.create (Navigator) error:', chrome.runtime.lastError);
      } else {
        console.log('[background] Navigator tab created with id:', tab?.id);
      }
    });

  } catch (err) {
    console.error('[background] Unexpected error in onMessage handler:', err);
  }
});

/* ============================== End of file: background.js ============================== */