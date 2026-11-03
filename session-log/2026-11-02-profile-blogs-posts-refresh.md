# 2026-11-02 — feat(profile): refresh button on Blogs and Posts tabs

## What
Adds the missing **refresh** button to a user profile's **Posts → Blogs** and **Posts → Posts** sub-tabs. It sits on the right of the sub-tab toggle, matching the existing button on Activities → Curation.

Clicking it clears the cached list for the visible sub-tab and fetches the first page again. The icon spins while loading, and the button is disabled during the fetch.

## Testing
- `npm run build` (lib + `tsc`) passes.
- Checked in the HiveSuite frontend dev server with headless Chromium on `/@sagarkothari88?tab=blogs`. Clicking refresh fired one new `get_account_posts` request and the list re-rendered.

HiveReactKit has no `RELEASE_NOTES_PENDING.md`. The user-facing bullet should go in hivesuite.app's `## Next` when this ships.
