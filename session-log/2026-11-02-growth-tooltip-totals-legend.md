# 2026-11-02 — feat(growth): legend checkboxes + day total in tooltip on HP and Earned graphs

## What
On a profile's **Growth** tab, for both the **Account HP** graph and the **Earned per day** graph:
- **Legend checkboxes.** Each legend entry is now a checkbox. Unticking it hides that series from the bars or line, removes its tooltip line, and rescales the chart to the series still ticked.
- **Day total in the tooltip.** The tooltip's date line now shows the total of the ticked series, for example `10/31 (total 129.598)` on the HP graph and `10/31 (total $7.70)` on the Earned graph.

The HP total is the plain sum of the ticked series for that day, with Power Down counted as negative. With **Account HP** ticked, the total includes the account's HP level, which gives a number like "10/26 (total 10,000)". With it unticked, the total is just that day's flows. The Earned total is in USD.

The checkbox state is per chart and lasts only for the session; it isn't saved.

## Testing
- `npm run build` (lib + `tsc`) passes.
- Screenshots come from the HiveSuite frontend dev server in headless Chromium on `/@sagarkothari88?tab=growth`, hovering 10/31.
