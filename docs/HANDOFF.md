# Handoff

State after v2.6 (branch `fix/harden-scanner-docs`, merged to `main`). Tests: `npm test`, 13/13 passing.

## Non-obvious decisions

- `readSelectedSystem` is injected into the page, so it must stay self-contained. No hoisted constants or helpers. `tests/scanner.test.js` extracts it from `background.js` by text markers (`function readSelectedSystem()` to `const ERROR_MESSAGES`).
- The page controls the system name and the Intel links. The name is allowlisted (`/^[A-Za-z0-9' -]{1,40}$/`) and goes into the Gatecheck fragment unencoded. Intel ids are parsed with `new URL`, host pinned to `zkillboard.com` or `eveeye.com`, 1-10 digits.
- No origin check before injecting: it would need the `tabs` permission (history warning). The scanner returns `no-panel` on non-Aperture pages instead.
- The default hub (`Jita`) is named in `background.js` `DEFAULT_DESTINATION` and the first `<option>` in `options.html` (`options.js` derives its fallback from it). Keep them in step.

## Not verified

- Nothing was run in a real browser or against live Aperture, Gatecheck or k162. Only the jsdom fixtures were run.
- No tests cover the new name allowlist or the Intel host pinning. A real system name with a character outside the allowlist would now show "not a system". Check against live data (apostrophes, any non-ASCII names).
- The parallel `executeScript` + storage read, the 300 ms save debounce and the `storage.onChanged` listener were not exercised in Chrome.
- Reviews (security, docs, dead code, optimization) ran on the pre-fix code. The fixes were not re-reviewed.
