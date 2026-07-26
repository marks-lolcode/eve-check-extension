ReadMe:

EVE Gatecheck Linker — v2.3 — Last updated 2026-07-26

This extension uses Aperture to open EVE Gatecamp Check for a system, routed to
the trade hub of your choice (Jita by default).

It works by reading whichever system you have selected on your Aperture map. It
takes the real system name from the Inspector panel, so it still works correctly
on systems you have given an alias.

Instillation Instructions:
1) Download this repository (Code -> Download ZIP on GitHub) and extract it
   somewhere on your computer, or clone it with git.
2) In Chrome, click on the Extensions button or select Extensions -> Manage Extensions from the kebab menu.
3) Make sure Developer Mode is turned on (toggle in upper right corner)
4) Click the button to "Load Unpacked"
5) Navigate to the folder where you extracted the files (the one containing
   manifest.json)
6) Click Select Folder
7) The extension should be installed

To use the extension:
1) Open your Aperture map
2) Make sure Aperture's Inspector panel is visible. The Inspector is part of
   Aperture itself, not part of this extension — you turn it on inside Aperture
   from Panels -> Inspector. This extension reads the selected system's real
   name out of that panel, so it cannot work while the panel is hidden.
3) Click the system you want to check
4) Click the logo for the extension

If no system is selected, or Aperture's Inspector panel is hidden, the extension
will show a notification telling you what to fix instead of opening a tab.

To change the destination hub:
1) Right-click the extension's logo and choose Options (or open Extensions ->
   Manage Extensions -> this extension -> Extension options)
2) Pick Jita, Amarr, Dodixie, Hek or Rens from the drop-down
3) It saves as soon as you pick it — close the window

The choice is stored in your Chrome profile and syncs with it. If you never
touch it, routes go to Jita as before.

Note: this version targets Aperture only. Pathfinder support was removed in
v2.0 — use v1 if you still need it.

The EVE Navigator link was removed in v2.1 (that tool is dead).

Maintainers: see MAINTAINING.md. This extension reads Aperture's HTML directly,
so an Aperture update can break it. That file records which parts of Aperture's
page it depends on and how to fix them.
