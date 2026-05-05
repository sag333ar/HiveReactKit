# ParentPostComposer

A **full-screen** composer for top-level Hive posts (blogs / articles). Same toolbar features as [`PostComposer`](./PostComposer.md) (markdown body, image / audio / video upload, GIF, emoji, template, poll, tags, reward, beneficiaries) plus:

- **Title** input (max 120 chars)
- **Description / summary** input (max 120 chars with live counter)
- **Side-by-side live preview** on desktop (`lg:`), stacked editor → preview on mobile — preview is always visible (no eye toggle)
- **Local draft persistence** to `localStorage` (debounced, hydrates on mount, auto-cleared on success)
- **3Speak v2 video pipeline** — upload to `video.3speak.tv/files/` with a client-generated `upload_id`, finalize via `/api/upload/finalize` (consumer-side)
- **3Speak posting-authority pre-flight gate** via `beforeVideoUpload`
- **Submit-label switch** — defaults to `"Publish"`, flips to `"Save"` whenever a 3Speak video is attached

## Installation

```bash
npm install hive-react-kit
```

```tsx
import { ParentPostComposer } from 'hive-react-kit';
import 'hive-react-kit/build.css';
```

## Quick Start

```tsx
<ParentPostComposer
  currentUser="alice"
  onSubmit={async (payload) => {
    // payload = { title, description, body, tags, reward, beneficiaries,
    //             poll, audioEmbedUrl, videoEmbedUrl, videoUploadDetails,
    //             hasVideo, isNsfw, ... }
    await broadcastBlogPost(payload);
  }}
  onCancel={() => navigate(-1)}
  ecencyToken={import.meta.env.VITE_ECENCY_TOKEN}
  threeSpeakApiKey={import.meta.env.VITE_3SPEAK_API_KEY}
/>
```

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Create post · Posting as @alice · ● Draft saved Clear │ Publish │
├──────────────────────────────────────────────────────────────────┤
│ Editor pane                       │  Preview pane (always on)    │
│ ─────────                         │  ────────────                │
│ Title                             │  Live preview (read time +   │
│ Short description (0/120)         │  word count chips)           │
│ [B] [I] [Link] [Code] [@]         │                              │
│ [Img] [Audio] [Video] [Emoji] …   │  Title (h1)                  │
│ [Tag] [Reward] [Beneficiaries]    │  Description italic intro    │
│                                   │  @author + tag chips         │
│ Audio / video / poll preview      │  ── divider ──               │
│                                   │  Rendered Hive markdown      │
│ Body textarea (fixed height)      │  via createHiveRenderer +    │
│                                   │  TranslatedBody +            │
│ #tags strip                       │  hive-post-body styles       │
│ Beneficiaries strip               │  (3Speak embeds upgraded to  │
│                                   │   <ThreeSpeakPlayer/>)       │
└──────────────────────────────────────────────────────────────────┘
```

- **Mobile (`< lg`)** — single column, the **outer container** scrolls so the editor and preview both expand to their natural heights and the user can scroll cleanly between them.
- **Desktop (`lg:` and up)** — two-pane, each pane has its own `overflow-y-auto`.

## Props

### Core

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSubmit` | `(payload: ParentPostSubmitPayload) => void \| boolean \| Promise<void \| boolean>` | Yes | — | Fired when the user clicks **Publish / Save**. Receives the full payload (see below). Return `false` to indicate cancellation — the composer keeps its state. Throw to surface an error. |
| `onCancel` | `() => void` | No | — | Fired when the user clicks the back/close button in the header. Typically `navigate(-1)`. |
| `currentUser` | `string` | No | `undefined` | Hive username — shown in the header chip and used as `username` for media uploads. |

### Initial values (uncontrolled)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialTitle` | `string` | `""` | Pre-fill the title input. |
| `initialDescription` | `string` | `""` | Pre-fill the 120-char description. |
| `initialBody` | `string` | `""` | Pre-fill the markdown body. |
| `initialTags` | `string[]` | `[]` | Pre-fill the user-tag chips (locked tags come from `lockedTags`). |

### Tags

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lockedTags` | `string[]` | `undefined` | Tags shown with a 🔒 icon — cannot be edited or removed. App identifiers go here (e.g. `["hivesuite"]`). Always emitted first. |
| `maxTags` | `number` | `10` | Cap on **total** tags including locked entries (Hive convention). |

The tag input splits on `Enter`, `,`, or whitespace, so pasting `hive dev hiveproject reactjs witness` adds 5 chips in one keystroke. Each token is normalised (lowercased, leading `#` stripped, internal whitespace replaced with `-`).

### Reward + Beneficiaries

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultReward` | `RewardOption` | `'default'` | Initial reward routing — `'default' \| 'power_up' \| 'burn' \| 'decline'`. |
| `defaultBeneficiaries` | `Beneficiary[]` | `[]` | Pre-populated beneficiary list. The threespeakfund 10% lock is **auto-injected** when a video is attached and user share is capped at 90%. |
| `beneficiaryFavorites` | `Beneficiary[]` | `[]` | Suggestion chips inside the [BeneficiariesEditor](./BeneficiariesEditor.md) modal. Typically pulled from a per-user history store. |

### Upload tokens (same plumbing as `PostComposer`)

| Prop | Type | Notes |
|------|------|-------|
| `ecencyToken` | `string` | Enables image upload (paste / drag-drop / toolbar). |
| `onSignMessage` | `PostingSignMessageFn` | Posting-key signer used as the Hive-images.blog fallback when Ecency upload fails. |
| `signingUsername` | `string` | Hive username to pair with the Hive-images.blog fallback. |
| `threeSpeakApiKey` | `string` | Enables the audio + video toolbar entries. |
| `giphyApiKey` | `string` | Enables the GIF picker. |
| `templateToken` | `string` | HReplier API JWT — enables the template picker. |
| `templateApiBaseUrl` | `string` | Override the template API base URL. |

### Toolbar visibility

Each feature can be hidden individually. Defaults to `false` (visible).

| Prop | Hides |
|------|-------|
| `hideAudio` | Audio upload entry |
| `hideVideo` | Video upload entry |
| `hideGif` | GIF picker |
| `hideEmoji` | Emoji picker |
| `hideTemplate` | Template picker |
| `hidePoll` | Poll creator |
| `hideTags` | Tag manager |
| `hideReward` | Reward dropdown |
| `hideBeneficiaries` | Beneficiaries editor |

> The **video toolbar entry is currently commented out** in the kit while the 3Speak v2 publish flow is being verified. To re-enable, uncomment the `<VideoUploader … />` block in `src/components/composer/ParentPostComposer.tsx`.

### Submit labels + headers

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `submitLabel` | `string` | `"Publish"` | Button label when no video is attached. |
| `submitLabelWithVideo` | `string` | `"Save"` | Button label when a video is attached — 3Speak's flow registers the video via its API rather than broadcasting a Hive `comment` op, so "Save" is more accurate than "Publish". |
| `title` | `string` | `"Create post"` | Page title shown in the sticky header. |
| `walletApprovalLabel` | `string` | `"Open Keychain App & Approve"` | Banner shown while a wallet is pending. |
| `awaitingWalletApproval` | `boolean` | `false` | Force the blinking amber wallet banner on. Pair with your broadcast loading state. |

### 3Speak video flow

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `useThreeSpeakV2` | `boolean` | `false` | Routes the TUS upload to `video.3speak.tv/files/` with v2 metadata (`upload_id`, `owner`, `filename`, `filetype`). Required for the v2 finalize / thumbnail / reusable APIs. |
| `beforeVideoUpload` | `() => Promise<boolean>` | — | Async pre-flight gate run after the file is validated, before TUS starts. Use to check 3Speak posting authority and pop a "Grant Permission" modal. Resolve `true` to proceed, `false` to abort. |
| `allowLandscapeVideos` | `boolean` | `true` | Pass `false` to enforce portrait-only uploads (matches the Snaps Moments contract). |

### Local draft persistence

| Prop | Type | Description |
|------|------|-------------|
| `draftKey` | `string` | When set, the composer auto-saves its state to `localStorage[draftKey]` (debounced ~500 ms) and rehydrates from it on mount. The header subtitle shows `● Draft saved · Clear` once the first save lands. The draft is **wiped on a successful submit**. Pass a per-user key to isolate accounts on shared devices: `` `hivesuite-blog-draft-${username}` ``. |

The persisted state covers `title`, `description`, `body`, `userTags`, `reward`, `beneficiaries`, `audioEmbedUrl`, `audioDuration`, `videoEmbedUrl`, `videoUploadUrl`, `videoAspectRatio`, and `pollData`. Local blob URLs (`videoPreviewUrl`) are **not** persisted — they're regenerated from the file on the next session.

## Submit payload

```ts
interface ParentPostSubmitPayload {
  title: string;
  description: string;            // ≤ 120 chars
  body: string;                   // markdown body with audio/video URLs appended
  tags: string[];                 // locked + user, capped at maxTags
  reward: RewardOption;
  beneficiaries: Beneficiary[];   // post-lock (threespeakfund 10% auto when hasVideo)
  poll: PollData | null;
  audioEmbedUrl: string | null;
  videoEmbedUrl: string | null;
  videoUploadUrl: string | null;
  videoAspectRatio: string | null;
  videoUploadDetails: VideoUploadDetails | null;  // 3Speak metadata, see below
  hasVideo: boolean;              // convenience flag — true when videoUploadDetails is set
  isNsfw: boolean;                // from the toggle that appears under the video preview
}
```

`VideoUploadDetails` (from `<VideoUploader/>`) carries everything the 3Speak v2 finalize endpoint needs:

```ts
interface VideoUploadDetails {
  filename: string;          // TUS trailing filename
  originalFilename: string;  // user's original file name
  fileSize: number;          // bytes
  videoDuration: number;     // seconds (rounded)
  aspectRatio: string;       // "16/9" | "9/16" etc.
  embedUrl: string;          // empty in v2 — only known after finalize
  uploadUrl: string;         // TUS upload URL
  thumbnailBlob: Blob | null;
  uploadId: string;          // <owner>_<unix-ms>_<32-hex>
  isV2: boolean;
}
```

## Preview pane

The right-pane preview uses the **exact same rendering pipeline as [HiveDetailPost](./HiveDetailPost.md)**:

- `createHiveRenderer` (`@snapie/renderer`) — `baseUrl: 'https://peakd.com/'`, `assetsWidth: 640`, `assetsHeight: 480`, `convertHiveUrls: true`.
- HTML post-processing replaces 3Speak iframes / autolinked anchors with `.threeSpeakEmbed` placeholders, wraps audio iframes in `.audioWrapper`, and turns `<img alt="...">` into `<figure class="hive-img-figure"><figcaption>...</figcaption></figure>`.
- `useLayoutEffect` mounts a real `<ThreeSpeakPlayer/>` into every embed placeholder before paint.
- `<TranslatedBody className="hive-post-body" …>` wraps the rendered HTML so the kit's `.hive-post-body` CSS (headings, lists, blockquotes, code, links, captions, audio) lights up automatically.
- A broken-image fallback strips known proxy/gateway prefixes (`images.hive.blog/<dim>/…`, `images.ecency.com/<dim>/…`, `ipfs.io/ipfs/`, `ipfs.3speak.tv/ipfs/`) and retries with the original URL.
- A v2 fallback `<video controls>` renders the local blob whenever `videoUploadDetails.isV2 && videoPreviewUrl && !threeSpeakRef`, so the preview pane still has something to show before the consumer's finalize call returns a permlink.

## 3Speak v2 publish flow

The composer **does not broadcast** anything itself — it just emits the payload. For 3Speak video posts, the consumer typically:

1. Pre-flight authority check via `beforeVideoUpload` (e.g. `aioha.addAccountAuthority('threespeak', Posting, 1)` if missing).
2. TUS upload → kit produces `videoUploadDetails.uploadId`.
3. `POST https://video.3speak.tv/api/upload/finalize` with the `uploadId` + `title` + `description` + `tags` + `size` + `duration` + `originalFilename` + `community` + `declineRewards` + `rewardPowerup` + `beneficiaries` + `reusable` + `publish_type`. Returns `{ _id, permlink }`.
4. (Optional) `POST https://video.3speak.tv/api/upload/thumbnail/<videoId>` — multipart `thumbnail` blob.
5. (Optional) `PATCH https://tags.3speak.tv/api/video/<owner>/<permlink>/reusable` — `{ reusable: true }`.

3Speak's backend then publishes to Hive on the user's behalf using the `threespeak` posting authority. See `hivesuite/src/services/threespeakUploadService.ts` for a reference implementation.

## Undo / redo

The composer routes every programmatic edit (Bold, Italic, Code block, Mention, GIF, Emoji, Template, paste-image) through `document.execCommand('insertText', …)`. Each toolbar action lands as one undoable step in the browser's native input pipeline, so `Cmd+Z` / `Ctrl+Z` walks back through the history and `Cmd+Shift+Z` / `Ctrl+Y` redoes — same as native typing.

## Drag-and-drop / paste images

The whole editor pane is a drop target — releasing an image anywhere over the editor lights up the "Drop image to upload" overlay. Pasting an image from the clipboard onto the textarea triggers the same upload path. Both flows insert `![Image](url)` at the cursor, which the right-pane preview renders inline.

Both flows require `ecencyToken` (and optionally `onSignMessage` + `signingUsername` for the Hive-images.blog fallback).

## Body textarea

Fixed height that scales by breakpoint — `h-[480px] sm:h-[560px] lg:h-[640px]` — with `resize-none` so the browser doesn't show a drag handle. Internally scrollable when the body grows beyond the visible area.

## Full example

```tsx
import { useState, useRef, useCallback } from 'react';
import { ParentPostComposer } from 'hive-react-kit';
import type { ParentPostSubmitPayload } from 'hive-react-kit';

function CreateBlogPage() {
  const [authorityModalOpen, setAuthorityModalOpen] = useState(false);
  const authorityResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const checkVideoAuthority = useCallback(async () => {
    const ok = await hasThreespeakAuthority(username);
    if (ok) return true;
    setAuthorityModalOpen(true);
    return new Promise<boolean>((resolve) => {
      authorityResolverRef.current = resolve;
    });
  }, [username]);

  const handleSubmit = async (payload: ParentPostSubmitPayload) => {
    if (payload.hasVideo && payload.videoUploadDetails) {
      const finalize = await finalizeThreeSpeakUpload({
        uploadId: payload.videoUploadDetails.uploadId,
        owner: username,
        title: payload.title,
        description: payload.description
          ? `${payload.description}\n\n${payload.body}`
          : payload.body,
        tags: payload.tags,
        size: payload.videoUploadDetails.fileSize,
        duration: payload.videoUploadDetails.videoDuration,
        originalFilename: payload.videoUploadDetails.originalFilename,
        declineRewards: payload.reward === 'decline',
        rewardPowerup: payload.reward === 'power_up',
        beneficiaries: payload.beneficiaries,
        reusable: true,
        publishType: 'publish',
        token: import.meta.env.VITE_3SPEAK_API_KEY!,
      });
      if (!finalize.success) {
        toast.error(finalize.error);
        return false;
      }
      navigate('/blogs');
      return;
    }

    // Plain Hive `comment` op for blog posts without video.
    await comment(
      '',
      payload.tags[0] || 'hivesuite',
      payload.body,
      payload.title,
      buildJsonMetadata(payload),
      payload.reward,
      payload.beneficiaries,
    );
    navigate('/blogs');
  };

  return (
    <ParentPostComposer
      currentUser={username}
      title="Create blog post"
      submitLabel="Publish"
      submitLabelWithVideo="Save"
      lockedTags={['hivesuite']}
      defaultReward={savedDefaultReward}
      defaultBeneficiaries={savedDefaultBeneficiaries}
      beneficiaryFavorites={beneficiaryHistory}
      ecencyToken={ecencyToken}
      onSignMessage={signMessage}
      signingUsername={username}
      threeSpeakApiKey={import.meta.env.VITE_3SPEAK_API_KEY}
      giphyApiKey={import.meta.env.VITE_GIPHY_KEY}
      templateToken={token}
      allowLandscapeVideos
      draftKey={`my-app-blog-draft-${username}`}
      beforeVideoUpload={checkVideoAuthority}
      useThreeSpeakV2
      onSubmit={handleSubmit}
      onCancel={() => navigate(-1)}
    />
  );
}
```

## TypeScript

```ts
import type {
  ParentPostComposerProps,
  ParentPostSubmitPayload,
  VideoUploadDetails,
  Beneficiary,
  RewardOption,
} from 'hive-react-kit';
```

## Related

- [PostComposer](./PostComposer.md) — single-comment / snap composer with the same toolbar features.
- [BeneficiariesEditor](./BeneficiariesEditor.md) — modal used by `defaultBeneficiaries` / `beneficiaryFavorites`.
- [HiveDetailPost](./HiveDetailPost.md) — the rendering pipeline the preview pane mirrors.
