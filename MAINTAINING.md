# Maintaining EVE Gatecheck Linker

`MAINTAINING.md` — v1.6 — Last updated 2026-08-25

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
4. That function reads the system's real name out of the Inspector. For a
   k-space system it returns `{ name }`. For a J-space one it also reads the EVE
   solar system id out of the Intel panel and returns `{ name, systemId }`.
   Either way, a failure comes back as `{ error }`.
5. The service worker opens the right destination, or shows a notification
   explaining what went wrong:
   - `systemId` present → `https://k-162.space/?system=<id>`
   - otherwise → `https://eve-gatecheck.space/eve/#<system>:<hub>:shortest`,
     with the hub read from storage.

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

### Why J-space splits off

Wormhole systems have no stargates, so a Gatecheck route between one and a trade
hub does not exist — the old build opened a dead page for every J-code. k162 is
the wormhole-side equivalent, and it keys on the **EVE solar system id**, not the
name.

That id is the catch. The Inspector never renders it; Aperture's `data-id` is a
row id in its own database, not an EVE id. The Intel panel's outbound links are
the only place on the page that carries it, so **J-space routing needs two panels
open, not one.** With Intel hidden, the scanner returns `no-intel` rather than
falling back to Gatecheck — a Gatecheck link for a J-code is wrong, not merely
imperfect, so there is nothing to fall back to.

Detection is `/^J\d{6}$/` against the real name, **or** the exact name `Thera`.
The regex covers ordinary wormholes and drifter systems. Thera needs the extra
clause because it is the one wormhole system CCP gave a real name instead of a
J-code — it is just as gateless, so a Gatecheck route is just as meaningless.
The match is exact equality, not a substring: k-space names containing `Thera`
must keep going to Gatecheck.

Both branches take the same path from there, so Thera needs the Intel panel like
any other wormhole. Nothing is hardcoded — the id comes off the page, not from a
table in this repo.

If another gateless system turns up (Zarzakh is the obvious candidate — reached
by filament and Turnur rather than by gate, and untested here), it is one more
clause in the same condition.

## Permissions

Four, and each one is load-bearing. Keep it that way — every addition changes
the warning Chrome shows on install, and users judge an extension by it.

| Permission | Why | Warning it costs |
|---|---|---|
| `activeTab` | Host access to the clicked tab, granted on toolbar click and only for that invocation | None |
| `scripting` | `executeScript` to inject the scanner | None on its own |
| `notifications` | The error messages — the only feedback channel this extension has | "Display notifications" |
| `storage` | The destination hub | None |

**Do not go back to `host_permissions: ["<all_urls>"]`.** That is what v2.2.1
shipped, and it made Chrome warn "Read and change all your data on all
websites" — a hard sell for a tool that only ever touches the tab you clicked.
`activeTab` fits because injection *always* follows a click; there is no
background scanning to support.

**Do not add `tabs` back either.** `chrome.tabs.create()` works without it. The
`tabs` permission only unlocks sensitive fields (`url`, `title`, `favIconUrl`),
none of which this extension reads, and it costs a browsing-history warning.

If a future feature needs to read a tab's URL, or to scan without a click, both
of these stop being true — price that in before you build it.

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
| `button[aria-label="Hide Intel"]` | Intel panel header | J-space only. Same anchoring trick as the Inspector, same fragility. |
| An `<a>` matching `zkillboard.com/system/<id>` **or** `?system=<id>` | Intel panel links | J-space only. **The EVE solar system id**, which k162 needs and no other panel renders. Either link shape works, so losing one is survivable. |

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

**Do not add a `card-title` fallback.** At rc.14 the card title happened to hold the
real name even for an aliased system — but it renders a *connection heading* when a
connection is selected, and nothing defines it as a name field, so it is one Aperture
refactor away from holding the alias. Falling back to it hands back a non-system name
and opens a bogus route, defeating the `not-a-system` check. An absent Alias input is
a hard failure on purpose. Failing loudly beats guessing wrong.

## What Aperture's panels actually expose

Field inventory taken live against `ap.dkvc.space` on 2026-08-25, with wormhole
system `J160941` selected and aliased to `Florida` (tag `🐊`). Nothing here is
read by the extension today — it is the menu you are choosing from if a future
feature needs more than the name, and the reference for spotting what changed
after an Aperture update.

Panels are addressed the same way the scanner addresses the Inspector: find
`button[aria-label="Hide <Panel>"]`, then `.closest('.react-grid-item')`. Every
panel in this layout follows that pattern — Map, Signatures, Inspector, Routes,
Intel, Structures, Kill Statistics, System Graph, System Killboard, Tags,
Eve-Scout, Signature Search.

### Inspector

Anchor: `button[aria-label="Hide Inspector"]`. Renders only for the current
selection; empty state reads `Select a system, connection, or note`.

| Field | Where | Live value in the sample |
|---|---|---|
| Card title | `[data-slot="card-title"]` | `J160941` — the **real name**, see the note below |
| Status | `[data-slot="select-trigger"] [data-slot="select-value"]`, plus a hidden `input` carrying the same value | `friendly` |
| Alias | `span` reading `Alias`, then `input[data-slot="input"]` | `placeholder="J160941"` (real name), `value="Florida"` (alias) |
| Tag | `span` reading `Tag`, then `input[data-slot="input"]` | `placeholder="—"`, `value="🐊"` |
| Intel notes | `textarea[placeholder="Notes are committed on blur."]` | free-text corp notes, kilobytes of it |
| Locked | `label > input[type=checkbox]`, `span` `Locked`, `span` `by <character name>` | locked by a named character |
| Set rally | `button[data-slot="button"]` | — |
| Remove | `button[data-slot="button"]`, gated by `span` `Unlock to remove` | — |

No links, no images, and **no security, class, region, or jump count** — those are
not in the Inspector at all. Class and statics live on the map node
(`.react-flow__node`), whose text for the sample reads
`14 | C2 | 🐊 | Florida | C3 | H` — jumps, class, tag, **alias**, statics — and
whose `data-id` is `1`, an Aperture row id. Region and security live in the Intel
panel, below.

### Intel

Anchor: `button[aria-label="Hide Intel"]`. Follows the same selection as the
Inspector.

| Field | Where | Live value in the sample |
|---|---|---|
| Region | `dl > dt` `Region` + `dd` | `B-R00004` |
| Constellation | `dt` `Const.` + `dd` | `B-C00023` |
| Security | `dt` `Security` + `dd > span` | `-1.0` |
| Sovereignty | bare `<p>` | `No sovereignty data.` |
| EVE-Scout | `span` `EVE-Scout` + `span` | `No Thera / Turnur hits.` |
| DOTLAN | `a` | `evemaps.dotlan.net/map/B-R00004/J160941` |
| EVEEYE | `a` | `eveeye.com/?system=31000376` |
| Anoik | `a` | `anoik.is/systems/J160941` |
| zKill | `a` | `zkillboard.com/system/31000376/` |

**The two id links are load-bearing now, not spare parts.** `?system=<id>` (EVEEYE)
and `/system/<id>/` (zKill) are what J-space routing reads; lose both and every
J-code selection turns into a `no-intel` notification. The name links (DOTLAN,
Anoik) remain unused — they are the fallback source step 3 of
[the update playbook](#when-aperture-updates-and-it-breaks) points at, should the
Alias placeholder ever stop separating name from alias. None of the four is
alias-polluted.

Two things to know before leaning on it. The panel renders no system name in its
own text — the names exist only inside `href` attributes, so a fallback means URL
parsing, not text reading. And the panel offers no anchor of its own beyond the
hide button, so the same `aria-label` fragility applies twice over.

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
| Select a normal k-space system, click the button | Gatecheck opens with that system |
| **Alias a system, select it, click** | Gatecheck opens the **real** name, not the alias |
| **Select a J-code system, click** | **k162 opens on that system's id — not Gatecheck** |
| **Select Thera, click** | k162 opens on Thera's id — the one named wormhole system |
| **Alias a J-code system, select it, click** | k162 opens on the **real** system's id |
| Hide the Intel panel, select a J-code system, click | Notification, no tab |
| Hide the Intel panel, select a k-space system, click | Gatecheck opens as normal — k-space never touches Intel |
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
