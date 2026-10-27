# Handoff

State after v2.7 (branch `feat/firefox-support`, merged to `main`; v2.6 hardening is already released). Tests: `npm test`, 13/13 passing. `npx web-ext lint`: 0 errors, 1 expected warning (Firefox ignores `service_worker`).

## Firefox support

- One manifest serves both browsers: `background` lists `service_worker` (Chrome) and `scripts` (Firefox). Each ignores the other key.
- `browser_specific_settings.gecko.id` is `eve-gatecheck-linker@users.noreply.github.com`. It is permanent once published to AMO and `storage.sync` needs it. Do not change it.
- `background.js` and the options page needed no code changes.

## Non-obvious decisions

- `readSelectedSystem` is injected into the page, so it must stay self-contained. No hoisted constants or helpers. `tests/scanner.test.js` extracts it from `background.js` by text markers (`function readSelectedSystem()` to `const ERROR_MESSAGES`).
- The page controls the system name and the Intel links. The name is allowlisted (`/^[A-Za-z0-9' -]{1,40}$/`) and goes into the Gatecheck fragment unencoded. Intel ids are parsed with `new URL`, host pinned to `zkillboard.com` or `eveeye.com`, 1-10 digits.
- No origin check before injecting: it would need the `tabs` permission (history warning). The scanner returns `no-panel` on non-Aperture pages instead.
- The default hub (`Jita`) is named in `background.js` `DEFAULT_DESTINATION` and the first `<option>` in `options.html` (`options.js` derives its fallback from it). Keep them in step.

## Chrome Web Store listing

- `PRIVACY.md` is the privacy policy. The listing links to `https://github.com/marks-lolcode/eve-check-extension/blob/main/PRIVACY.md`, so do not move or rename it.
- Data disclosure answered: only "Website content" (the system name/ID read from the page and sent in the Gatecheck/k162 URL). No remote code.
- `assets/screenshot-1280x800.png` is the store screenshot. Build the upload zip without `tests/`, `node_modules/`, `.claude/`, `docs/` and the screenshot. `tests/scanner.test.js` uses `new Function`, which a reviewer could flag as remote code.

## Not verified

- The extension has not been loaded in Firefox, and Chrome was not re-checked after the manifest change. No AMO submission or signing has happened.

- Nothing was run in a real browser or against live Aperture, Gatecheck or k162. Only the jsdom fixtures were run.
- No tests cover the new name allowlist or the Intel host pinning. A real system name with a character outside the allowlist would now show "not a system". Check against live data (apostrophes, any non-ASCII names).
- The parallel `executeScript` + storage read, the 300 ms save debounce and the `storage.onChanged` listener were not exercised in Chrome.
- Reviews (security, docs, dead code, optimization) ran on the pre-fix code. The fixes were not re-reviewed.
