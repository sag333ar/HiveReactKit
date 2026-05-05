# BeneficiariesEditor

Modal that lets the user attach a list of Hive accounts that auto-receive a portion of the rewards on a post or comment. Used internally by [`PostComposer`](./PostComposer.md) and [`ParentPostComposer`](./ParentPostComposer.md), and also exported for standalone use.

## Features

- Per-row +/- spinners with `inputMode="numeric"` (iOS number pad)
- Hive avatar next to every account chip (with `ui-avatars.com` fallback)
- **`threespeakfund` 10% auto-lock** when `hasVideo` is `true` — the locked row is non-removable, the user-controlled allocation is capped at 90%, and existing entries are scaled proportionally to fit
- Favourites strip — clickable chips fed from the consumer's history store
- Total / remaining indicator
- Mobile-friendly bottom-sheet layout (stacked rows on `< sm`, full-width "Add" button)

## Quick start

```tsx
import { useState } from 'react';
import { BeneficiariesEditor } from 'hive-react-kit';
import type { Beneficiary } from 'hive-react-kit';

function MyComposer() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Beneficiary[]>([]);

  return (
    <>
      <button onClick={() => setOpen(true)}>Edit beneficiaries</button>
      <BeneficiariesEditor
        isOpen={open}
        onClose={() => setOpen(false)}
        onSave={(next) => setList(next)}
        initialBeneficiaries={list}
        hasVideo={false}
        favorites={[
          { account: 'sagarkothari88', weight: 5 },
          { account: 'peakd', weight: 5 },
        ]}
      />
    </>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | `boolean` | Yes | — | Controlled visibility. |
| `onClose` | `() => void` | Yes | — | Fired when the user clicks the X button or the backdrop. |
| `onSave` | `(beneficiaries: Beneficiary[]) => void` | Yes | — | Fired with the post-lock list when the user clicks Save. |
| `initialBeneficiaries` | `Beneficiary[]` | No | `[]` | Pre-populated rows on open. |
| `hasVideo` | `boolean` | No | `false` | When `true` the modal injects a locked `threespeakfund` 10% row and caps the user-controlled allocation at 90%. |
| `favorites` | `Beneficiary[]` | No | — | Suggestion chips below the editor. Click to add. |
| `title` | `string` | No | `"Beneficiaries"` | Header label. |
| `description` | `string` | No | _"Add a user you want to automatically receive a portion of the rewards for this post."_ | Hint shown under the header. |
| `saveLabel` | `string` | No | `"Save"` | Footer save button. |
| `cancelLabel` | `string` | No | `"Cancel"` | Footer cancel button. |

## `Beneficiary` shape

```ts
interface Beneficiary {
  /** Hive account name — lowercase, no leading @. */
  account: string;
  /** Whole-percent UI weight in [1, 100]. Hive's basis-point weight = weight * 100. */
  weight: number;
}
```

## Helper utilities

The kit exports a few helpers consumers usually want when broadcasting:

```ts
import {
  THREESPEAK_FUND_ACCOUNT,        // 'threespeakfund'
  THREESPEAK_FUND_PERCENT,        // 10
  bodyHasVideo,                    // boolean — does a markdown body contain a 3Speak embed URL
  normalizeBeneficiaryAccount,     // strip leading @, lowercase
  sanitizeBeneficiaries,           // dedupe, clamp weights to [1,100]
  totalBeneficiaryWeight,          // sum
  enforceVideoBeneficiaries,       // re-apply the threespeakfund 10% lock
  buildBeneficiariesCommentOptions,    // stand-alone comment_options op
  mergeBeneficiariesIntoCommentOptions,// merge with reward routing into one op
} from 'hive-react-kit';
```

### `mergeBeneficiariesIntoCommentOptions`

The most common helper — combines reward routing (`'default' | 'power_up' | 'burn' | 'decline'`) with a user-chosen beneficiary list into a single `comment_options` op tuple ready to push onto your `signAndBroadcastTx` array.

- For `'burn'`, additional beneficiaries are ignored (all rewards already go to `null`).
- For other reward options, the user's beneficiary list is included verbatim.
- Beneficiaries are sorted alphabetically by account (Hive requirement) and weights are wire-converted from whole-percent to basis points (`weight * 100`).
- Returns `null` when there's nothing to broadcast (default reward + no beneficiaries).

```ts
const op = mergeBeneficiariesIntoCommentOptions(
  username,
  permlink,
  'default',
  [
    { account: 'sagarkothari88', weight: 5 },
    { account: 'null', weight: 1 },
  ],
);
// → ['comment_options', {
//   author, permlink,
//   max_accepted_payout: '1000000.000 HBD',
//   percent_hbd: 10000,
//   allow_votes: true, allow_curation_rewards: true,
//   extensions: [[0, { beneficiaries: [
//     { account: 'null', weight: 100 },
//     { account: 'sagarkothari88', weight: 500 },
//   ] }]],
// }]
```

### `enforceVideoBeneficiaries`

Re-apply the `threespeakfund` 10% lock to an arbitrary list. Used internally by `BeneficiariesEditor` and by composers when the video state toggles.

```ts
enforceVideoBeneficiaries(
  [{ account: 'alice', weight: 100 }],
  /* hasVideo */ true,
);
// → [{ account: 'threespeakfund', weight: 10 },
//     { account: 'alice', weight: 90 }]
```

If the existing user share exceeds 90%, every entry is scaled by `90 / userTotal` (floor) so the lock fits without breaking the user's intent.

## TypeScript

```ts
import type {
  BeneficiariesEditorProps,
  Beneficiary,
  RewardOption,
} from 'hive-react-kit';
```

## Related

- [PostComposer](./PostComposer.md) — uses this modal via `defaultBeneficiaries` / `beneficiaryFavorites` / `onBeneficiariesChange`.
- [ParentPostComposer](./ParentPostComposer.md) — same wiring for the full-screen blog composer.
