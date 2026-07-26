# Maintaining EVE Gatecheck Linker

`MAINTAINING.md` — v1.2 — Last updated 2026-07-26

For anyone changing this extension. End-user install/usage lives in `readme.txt`.

## The one thing to know

**This extension screen-scrapes Aperture's HTML.** Aperture is a third-party app;
it owes us no stable DOM. When it ships a new version, this extension can break
with no warning and no error — the failure mode is a notification saying "No
system selected" when a system plainly *is* selected.

Last verified against **Aperture v1.0.0-rc.14** (shown bottom-left of Aperture's
header). If you are reading this on a much later version and things look wrong,
suspect the selectors first. [The DOM contract](#the-dom-contract) below lists
exactly what we depend on.

## How it works

`background.js` does the scanning and routing; `options.html` / `options.js` do
nothing but store one string.

1. You click a system on the Aperture map. Aperture renders it in the Inspector panel.
2. You click the extension's toolbar button.
3. `chrome.action.onClicked` fires; `chrome.scripting.executeScript` injects
   `readSelectedSystem` into the page.
4. That function reads the system's real name out of the Inspector and returns
   `{ name }` or `{ error }`.
5. The service worker reads the destination hub from storage and opens
   `https://eve-gatecheck.space/eve/#<system>:<hub>:shortest`, or shows a
   notification explaining what went wrong.

There is no content script and no popup. `chrome.action.onClicked` only fires when
no `default_popup` is set, and `executeScript` returns the scanner's value
directly — so no message passing is needed. Keep it that way unless you have a
reason. The options page is `options_ui` with `open_in_tab: false`, which is a
separate surface and does not affect `onClicked`; adding a `default_popup` would.

`readSelectedSystem` is passed to `executeScript` by reference, which serializes
it and runs it in the page. **It therefore cannot close over anything** — no
imports, no outer constants, no helpers. It must stay entirely self-contained.
`getDestination()` is used by `openGatecheck`, which runs in the service worker,
not in the page.

## The destination setting

One key: `destination` in `chrome.storage.sync`, holding a hub name string.
Unset, unreadable, or not on the `HUBS` list → `Jita`. There is no
`onInstalled` seeding step, deliberately: the default lives in exactly one
place (the fallback in `getDestination`), so a profile that never opens the
options page and a profile whose sync data is stale behave identically.

The hub list exists in three places and they must agree:

| Where | Role |
|---|---|
| `HUBS` in `background.js` | Validates what comes out of storage before it reaches the URL |
| `<select>` options in `options.html` | What the user can pick |
| `isKnownHub()` in `options.js` | Reads the `<select>`, so it follows the HTML automatically |

A service worker cannot share a plain `const` with a page script without ES
modules or a build step, and this extension has neither by design. Adding a hub
is a two-file edit: `HUBS` and the `<select>`. Both validate, so a mismatch
fails closed (the dropdown shows Jita, or the URL routes to Jita) rather than
emitting a bogus route.

Gatecheck accepts hub names in the same position as any system name, so nothing
else in the URL changes.

## The DOM contract

Everything the extension needs from Aperture's page. If one of these changes, we break.

| We depend on | Where | Why this one |
|---|---|---|
| `button[aria-label="Hide Inspector"]` | Inspector panel header | Locating the panel. Its Tailwind classes and generated `base-ui-*` ids both churn; the `aria-label` is the most stable handle available. |
| `.react-grid-item` | Ancestor of the above | The panel's outer box. Used only as a scoping boundary via `.closest()`. |
| A `<span>` reading exactly `Alias` | Inside the Inspector | Locating the alias field by its visible label, since the input has no distinguishing id or name. |
| `input[data-slot="input"]` next to it | Same flex wrapper as the label | The alias field itself. |
| **`.placeholder` of that input** | | **The real system name.** See below. |
| Text `Select a system, connection, or note` | Inspector empty state | Distinguishes "nothing selected" from "a connection/note is selected", so the notification can be specific. |

### Why the placeholder, and not the map node

The obvious approach — read the name off the map node — is **wrong**, and fails silently.

Aperture's map node shows the system's **alias**. Setting an alias *replaces* the
real name in the node. When `Perimeter` was aliased to `OOPS`, the string
`Perimeter` appeared **nowhere in the entire document**:

```html
<span aria-label="Alias">OOPS</span>        <!-- alias ate the real name -->
<span>1J</span>                              <!-- jumps to hub: not identifying -->
<span class="truncate">The Forge</span>      <!-- region only: ~100 systems -->
data-id="5297"                               <!-- Aperture's row id, NOT an EVE system id -->
```

A node-based scanner would emit `#OOPS:Jita:shortest` and 404 — with no error.
`data-id` is Aperture's own database id, so it cannot be resolved against ESI either.

The Inspector is the only place that keeps the two apart:

```html
<div class="flex flex-col gap-1">
  <span class="text-[10px] text-muted-foreground">Alias</span>
  <input data-slot="input" placeholder="Perimeter" value="OOPS">
  <!--                     ^^^^^^^^^^^^^^^^^^^^^^ real name (what we read)
                                                  ^^^^^^^^^^^^ alias -->
</div>
```

`placeholder` is the real name **by definition** — it is what Aperture shows you
when no alias is set. That is the whole reason this design reads the Inspector,
and it only renders for the *selected* system. Hence: selection required.

### Two traps

**Scope the query.** A bare `document.querySelector('input[placeholder]')` returns
`"Start system…"` — the Routes panel renders before the Inspector. Other decoys:
`"Add destination…"`, Signature Search's `"Search…"`, and the Inspector's *own*
Tag input (`placeholder="—"`). Always go through the panel.

**Do not add a `card-title` fallback.** It looks tempting when the Alias input is
missing, but it renders the *alias* for an aliased system and a *connection heading*
when a connection is selected — so it hands back a non-system name and opens a bogus
route, defeating the `not-a-system` check. An absent Alias input is a hard failure
on purpose. Failing loudly beats guessing wrong.

## Rejected design: reading connections off the map

Routing is driven entirely by what you click, so the extension never needs to
walk Aperture's edges. That is deliberate — an earlier design tried it and was
abandoned. If you are about to rebuild it, know what you are taking on.

The edge **type** label is the blocker. It lives in
`.react-flow__edgelabel-renderer` as an absolutely-positioned div with **no DOM
link back to its edge**. The only association is geometry — the label sits at the
edge path's midpoint:

```
edge path:  M850,220.5 C925,220.5 925,230.5 1000,230.5   -> midpoint (925, 225.5)
label:      transform: translate(-50%,-50%) translate(925px, 225.5px)
```

So you must match each label to an edge by nearest midpoint. Both live in the same
viewport coordinate space, so the numbers compare directly — but it is a float
comparison against a third-party layout, and it silently mis-pairs on dense maps.

Even with all that, you still cannot read the target's name — the alias problem
above still applies, so you *still* need the Inspector, which still needs a
selection. Walking the map buys nothing and adds every fragile part.

## When Aperture updates and it breaks

1. Open the map, select a system, open DevTools.
2. Check the panel anchor: `document.querySelector('button[aria-label="Hide Inspector"]')`.
   Null means the label changed — find the Inspector's new hide-button label.
3. Check the field: find the `Alias` label span, then its sibling `input`. Confirm
   `placeholder` still holds the real name and `value` holds the alias. **If Aperture
   ever stops separating them, this whole approach dies** and you will need another
   source (the Intel panel's `anoik.is` / `dotlan` hrefs also carry the real name,
   and zKill's href carries the solar system id).
4. Fix the selector in `readSelectedSystem`, update the table above, bump the version.

## Testing

### Automated

```
npm install   # jsdom, the only dependency, and only for tests
npm test
```

`tests/scanner.test.js` runs `readSelectedSystem` against fixtures rebuilt from
real rc.14 DOM dumps — including the aliased case and the decoy panels that break
an unscoped query. It extracts the function from `background.js` rather than
copying it, so it always tests shipped code.

The extension itself has **no dependencies and no build step**. `npm` is here for
tests only; you still load the repo folder directly via Load Unpacked.

If you change `readSelectedSystem`'s name, or move `ERROR_MESSAGES`, the extractor
markers in the test file need updating — it throws a clear error if so. The
extractor slices between those two markers, so anything you add *outside* that
range (`HUBS`, `getDestination`, …) is invisible to the tests and safe.

The options page and `getDestination` are **not** covered — they need a
`chrome.storage` stub, and the destination rows in the manual matrix below cover
them cheaply.

### Manual

Automated tests use fixtures, so they cannot tell you Aperture changed its DOM.
**Only the live matrix can.** Run it after any Aperture update:

| Do this | Expect |
|---|---|
| Select a normal system, click the button | Gatecheck opens with that system |
| **Alias a system, select it, click** | Gatecheck opens the **real** name, not the alias |
| Select nothing, click | Notification, no tab |
| Select a *connection*, click | Notification, no tab |
| Hide the Inspector panel, click | Notification, no tab |
| Click on a non-Aperture tab | Notification, no tab |
| Set the hub to Rens, select a system, click | URL ends `:Rens:shortest` |
| Reopen Options after setting a hub | Dropdown still shows that hub |
| Fresh profile, never open Options, click | URL ends `:Jita:shortest` |

The alias row is the important one — it is the bug this design exists to prevent,
and it is invisible unless you specifically alias something.

Watch the service worker console while testing: `chrome://extensions` → this
extension → "service worker". Every decision is logged under `[background]`,
including the scanner's raw return value.

## Files

| File | What |
|---|---|
| `background.js` | Scanner + service worker. |
| `options.html` / `options.css` / `options.js` | Options page. Destination hub only. |
| `manifest.json` | MV3. No `default_popup` — that is what makes `action.onClicked` fire. |
| `assets/icon*.png` | 16/32/48/128. Also the notification icon. |
| `tests/scanner.test.js` | jsdom tests for the scanner. |
| `readme.txt` | End-user install/usage. |
| `MAINTAINING.md` | This file. |

## Conventions

- Version + date header on every file, per the repo owner's standard:
  `// <file> — vX.Y — Last updated YYYY-MM-DD`. Bump on every functional change.
- Keep the `[background]` log prefix and the `chrome.runtime.lastError` checks
  after every `chrome.*` callback — they are the only debugging surface a service
  worker has.
- Notifications require `iconUrl` to resolve. It points at `assets/icon128.png`;
  if icons move, **update `background.js` too**, or every error notification
  throws instead of showing.
