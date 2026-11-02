# IBU_CAL_C — Chrome / Edge extension

A compact browser calculator with scientific functions, local history, light/dark themes, land-area conversions, and an optional best-effort F1 key guard.

## Features
- Standard calculator with keyboard input, result preview, Ans, percentage, parentheses, copy, and history.
- Scientific functions: trigonometry, inverse trigonometry, square root, powers, logarithms, factorial, π, e, reciprocal, absolute value, and DEG/RAD mode.
- Land converter dropdown:
  - Feet dimensions to acres using one rectangle (2 inputs) or two rectangles (4 inputs).
  - Square feet to acres using one area input.
  - Varas dimensions to acres using four inputs for two rectangles.
- Acre results display three decimal places with standard mathematical rounding.
- Light/dark theme, compact responsive layout, and a custom SVG logo / PNG extension icons.
- F1 guard can be paused or resumed from the `F1` button.

## Install locally
1. Extract this folder somewhere on your computer.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the `Orbit_Calculator_Extension` folder.
5. Pin IBU_CAL_C if you want quick access.

After replacing files, return to the extensions page and press **Reload**.

## F1 guard limitations and Edge setup
1. Open `edge://extensions`.
2. Find IBU_CAL_C and select **Details**.
3. Under **Site access**, choose **On all sites** (or allow the specific website you want to protect).
4. Click **Reload** on the extensions page, then refresh the website being tested.
5. Keep the F1 button in the extension set to active (`F1 ✓`), not paused (`F1 ⏸`).

The guard attempts to cancel F1 on ordinary HTTP/HTTPS webpages before page-level keyboard handlers run. It does not show an alert, so it will not interrupt your workflow. However, Edge may handle F1 as a browser-level shortcut before the webpage receives the key event. Extensions cannot reliably override browser-reserved shortcuts, and the guard cannot run on browser-internal pages such as `edge://`, the address bar, or Edge's own UI. This is a best-effort guard, not a guaranteed way to disable Edge Help. It does not send or store browsing content; the on/off preference is stored locally.

## Varas conversion basis
This build assumes **1 vara = 0.835905 metres** and converts square varas to acres using 1 acre = 4,046.8564224 square metres. Vara definitions differ by region; verify that this basis matches the land-measurement standard you use before relying on the result for legal or financial decisions.
