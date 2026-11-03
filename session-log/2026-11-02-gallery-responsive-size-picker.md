# 2026-11-02 — feat(gallery): responsive grid + Small/Medium/Large thumbnail size picker

## Problem
The profile **Gallery** tab was stuck at 2 columns even on a wide desktop; see `item6-before-desktop.png`, labelled BEFORE. The grid's responsive Tailwind classes (`sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`) aren't in the CSS the host app ships, so only `grid-cols-2` applied.

## Fix
- The grid now uses an inline `repeat(auto-fill, minmax(min(<size>px, 100%), 1fr))` layout, so it adds columns as the screen widens and doesn't depend on the host's Tailwind build. The loading skeleton uses the same grid.
- A **Thumbnail size** picker (Small / Medium / Large) above the grid sets the minimum tile width to 110, 170 or 260 px. That changes the column count, e.g. about 12, 8 or 5 columns on a 1440 px desktop, and 3, 2 or 1 on a phone.
- The choice is saved in `localStorage` (`hrk-gallery-thumb-size`) and restored after a reload (checked in a headless browser). The default is Medium.

## Testing
- `npm run build` (lib + `tsc`) passes.
- Screenshots come from the HiveSuite frontend dev server in headless Chromium on `/@sagarkothari88?tab=gallery`, at 1440 px and 390 px wide, for each size.
