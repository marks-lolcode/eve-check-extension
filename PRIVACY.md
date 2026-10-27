# Privacy Policy — EVE Gatecheck Linker

`PRIVACY.md` — v1.0 — Last updated 2026-10-27

EVE Gatecheck Linker ("the extension") is a browser extension that opens a gatecamp check for the solar system selected on your Aperture map. This policy explains what data the extension handles.

## What the extension reads

Only when you click the extension's toolbar icon, the extension reads the following from the tab you clicked:

- The name of the solar system selected in Aperture's Inspector panel.
- For wormhole systems, that system's numeric ID from links in Aperture's Intel panel.

To find those, it looks at the labels and text of the Inspector panel (for example, to tell whether anything is selected) and at the link addresses in the Intel panel. Everything except the system name and ID is discarded immediately. It never reads other parts of the page, and never reads any other tab.

## Where that data goes

The system name or ID is placed in the address of a new tab that the extension opens:

- Known-space systems: `eve-gatecheck.space`, with your chosen trade hub.
- Wormhole systems: `k-162.space`.

Those sites receive the system name or ID when the tab loads, as with any link you open. Their own privacy policies apply to what they do with it. The extension does not send data anywhere else.

## What the extension stores

The extension saves one setting: the trade hub you pick on its Options page (Jita, Amarr, Dodixie, Hek or Rens). It is stored with your browser's built-in extension storage and syncs with your browser profile if you have sync turned on. You can clear it by removing the extension.

## What the extension does not do

- It does not collect personal information, credentials, browsing history, location or activity.
- It does not use analytics, tracking, cookies or advertising.
- It has no server, and its developer receives no data from it.
- It does not sell or transfer data to anyone, or use it for any purpose other than opening the check described above.

## Changes

If this policy changes, the updated version will be posted at this address with a new date.

## Contact

Questions: open an issue at https://github.com/marks-lolcode/eve-check-extension/issues
