# PostComposer

A rich markdown composer component with live preview, media upload (image, audio, video), paste/drag-drop image upload, GIF search, emoji picker, template picker, poll creator, code block support with copy-to-clipboard, and @ mention.

Formerly `AddCommentInput` — the old name is still available as a deprecated re-export for backward compatibility.

## Installation

```bash
npm install hive-react-kit
```

```tsx
import { PostComposer } from 'hive-react-kit';
import 'hive-react-kit/build.css';
```

## Quick Start

```tsx
<PostComposer
  onSubmit={(body) => console.log("Submitted:", body)}
  onCancel={() => console.log("Cancelled")}
  currentUser="sagarkothari88"
  placeholder="Write something..."
  submitLabel="Publish"
/>
```

## Props

### Core Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSubmit` | `(body: string) => void \| Promise<void>` | Yes | - | Called with the final markdown body (includes audio/video embed URLs appended). **Throw an error** from this callback to prevent the composer from clearing — useful when blockchain posting fails (e.g. Keychain rejection) |
| `onCancel` | `() => void` | No | - | Called when Cancel button is clicked or Escape is pressed |
| `currentUser` | `string` | No | `undefined` | Hive username. Shows avatar and `@username` in the header |
| `placeholder` | `string` | No | `"Write in Markdown..."` | Textarea placeholder text |
| `parentAuthor` | `string` | No | `undefined` | Shows "Replying to @author" in header. Used by @ mention button and template `{{author}}` substitution |
| `parentPermlink` | `string` | No | `undefined` | Parent permlink for context |
| `title` | `string` | No | `undefined` | Optional title displayed above the composer |
| `submitLabel` | `string` | No | `"Post"` | Label for the submit button |
| `showCancel` | `boolean` | No | `true` | Show/hide the Cancel button |
| `defaultPreviewOn` | `boolean` | No | `false` | Whether the live preview is visible by default |

### Controlled Mode

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string` | No | `undefined` | External body value. When provided, PostComposer becomes a controlled component |
| `onChange` | `(value: string) => void` | No | `undefined` | Called on every text change. Use with `value` for controlled mode |
| `disabled` | `boolean` | No | `false` | Disable the entire composer (all toolbar buttons, textarea, and submit) |

> **Note:** When `value` is reset to `""` externally (e.g. after a successful submit by a parent component), audio/video attachments are automatically cleared. Polls are NOT cleared on text reset — they are independent and only cleared on successful submit or explicit remove.

### API Tokens

These tokens enable rich media features. When a token is not provided, the corresponding toolbar button is automatically hidden.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ecencyToken` | `string` | No | `undefined` | Ecency image hosting token. Enables **image upload** (toolbar button), **video thumbnail upload**, and **paste/drag-drop image upload**. Images upload to `images.ecency.com` |
| `threeSpeakApiKey` | `string` | No | `undefined` | 3Speak API key. Enables **audio recording/upload** and **video upload** (TUS chunked protocol). Without it, audio and video buttons are hidden |
| `giphyApiKey` | `string` | No | `undefined` | GIPHY API key. Enables **GIF search** modal. Without it, the GIF button is hidden |
| `templateToken` | `string` | No | `undefined` | HReplier API JWT token. Enables **template picker** — fetches saved templates and inserts at cursor. Without it, the template button is hidden |
| `templateApiBaseUrl` | `string` | No | `https://hreplier-api.sagarkothari88.one/data/templates` | Custom template API endpoint. Override when self-hosting the template service |

### Toolbar Visibility

All toolbar features can be individually hidden regardless of token availability.

| Prop | Type | Default | Hides |
|------|------|---------|-------|
| `hideBold` | `boolean` | `false` | Bold button |
| `hideItalic` | `boolean` | `false` | Italic button |
| `hideLink` | `boolean` | `false` | Link button |
| `hideCode` | `boolean` | `false` | Code block button |
| `hideMention` | `boolean` | `false` | @ Mention button |
| `hideImage` | `boolean` | `false` | Image upload button |
| `hideAudio` | `boolean` | `false` | Audio upload button |
| `hideVideo` | `boolean` | `false` | Video upload button |
| `hideEmoji` | `boolean` | `false` | Emoji picker button |
| `hideGif` | `boolean` | `false` | GIF picker button |
| `hideTemplate` | `boolean` | `false` | Template picker button |
| `hidePreview` | `boolean` | `false` | Preview toggle button |
| `hidePoll` | `boolean` | `false` | Poll creator button |

### Poll

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `hidePoll` | `boolean` | No | `false` | Hide the poll button in the toolbar |
| `onPollChange` | `(poll: PollData \| null) => void` | No | - | Called when a poll is attached, edited, or removed. Receives `PollData` on attach/edit, `null` on remove. Use this to include poll data in your post metadata |

### Appearance

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `hideUserHeader` | `boolean` | No | `false` | Hide the avatar + username + "Replying to" header |
| `hideSubmitArea` | `boolean` | No | `false` | Hide the built-in submit button and "Cmd+Enter to post" hint. Use when providing external submit buttons |
| `bgColor` | `string` | No | `"#111827"` | Custom background color for the composer container (CSS color value) |
| `borderColor` | `string` | No | `"#374151"` | Custom border color for the composer container (CSS color value) |

## Layout

The component renders in this order (top to bottom):

1. **Title** (optional)
2. **User header** — avatar + username + "Replying to" line (hideable via `hideUserHeader`)
3. **Live preview** — rendered markdown via `@snapie/renderer` (toggleable, max 300px, scrolls internally)
4. **Audio attachment preview** — embedded player with remove button (shown after upload)
5. **Video attachment preview** — video player with remove button (shown after upload)
6. **Poll preview** — question, choices chips, end date, edit/remove buttons (shown after poll creation)
7. **Toolbar** — Preview, Bold, Italic, Link, Code, @Mention, Image, Audio, Video, Emoji, GIF, Template, Poll
8. **Textarea** — with paste/drag-drop support
9. **Actions** — keyboard hint, Cancel, Submit (hideable via `hideSubmitArea`)

## Features

### Live Preview

Toggle via the Eye icon in the toolbar. Uses `@snapie/renderer` (`createHiveRenderer`) for full Hive markdown rendering including:

- 3Speak video and audio embeds
- IPFS content with fallback gateways
- Twitter/X tweet embeds
- Instagram post embeds
- Hive frontend URL conversion
- XSS sanitization via DOMPurify

Preview has a max height of 300px and scrolls internally.

### Image Upload

- **Toolbar button**: Click to select an image file (max 10MB). Uploads to Ecency image hosting and inserts `![Image](url)` at cursor.
- **Paste**: Paste an image from clipboard (Cmd/Ctrl+V). Auto-detects image data and uploads.
- **Drag & drop**: Drag image files onto the textarea area. Shows blue dashed border during drag. Supports multiple files.

All three methods require `ecencyToken`.

### Audio Upload

- Record via microphone (up to 5 minutes) or upload from file (MP3, WAV, OGG, max 50MB)
- Uploads to 3Speak audio API
- Preview shows embedded player with playback controls
- Only one audio attachment allowed at a time — button disabled while attached
- Remove to re-enable upload

### Video Upload

- Upload video file (MP4, MOV, WebM, max 100MB, max 90s)
- Uses TUS chunked upload protocol to 3Speak
- Auto-generates thumbnail uploaded to Ecency
- Preview shows video player with controls
- Only one video attachment allowed at a time — button disabled while attached
- Remove to re-enable upload

### Poll Creator

- Click the BarChart3 icon in the toolbar to open the poll creation modal
- Configure: question, 2-10 choices, end date/time, max choices per voter, allow vote changes, minimum account age, hide results until voted
- Poll preview card appears above the toolbar showing question, choice chips, end date
- Edit button reopens the modal with current data; remove button clears the poll
- `onPollChange` callback fires on every attach/edit/remove — use it to include poll data in your post metadata
- Polls persist when textarea text is cleared — only cleared on successful submit or explicit remove
- Hidden in reply mode via `hidePoll={true}`

### Code Blocks

- **Fenced code block**: Select multi-line text (or empty) → click Code icon → wraps in ` ``` `
- **Inline code**: Select single-line text → click Code icon → wraps in backticks
- Preview shows code blocks with hover-to-copy buttons
- Click inline code in preview to copy

### @ Mention

- If `parentAuthor` is set, inserts `@{parentAuthor} ` at cursor
- Otherwise inserts bare `@`

### Template Picker

- Fetches templates from the HReplier API using `templateToken`
- Searchable modal with template name and body preview
- `{{author}}` placeholders in templates are replaced with `parentAuthor`
- Requires `templateToken` — button hidden without it

### Emoji Picker

- 500+ emojis across 9 categories: Smileys, Gestures, People, Animals, Food, Travel, Objects, Symbols, Flags
- Category tabs with emoji icons (not text)
- Search bar to filter across all categories
- Fixed height (480px) with hidden scrollbars

### Keyboard Shortcuts

- **Cmd/Ctrl + Enter**: Submit
- **Escape**: Cancel (if `onCancel` provided)

## Error Handling

When `onSubmit` **throws an error**, PostComposer catches it and preserves all state (body text, audio/video attachments, poll). This is important for blockchain posting workflows:

```tsx
<PostComposer
  onSubmit={async (body) => {
    try {
      await broadcastToHive(body);  // e.g. via Keychain/Aioha
    } catch (e) {
      toast.error(e.message);       // Show the error to user
      throw e;                       // Re-throw so PostComposer doesn't clear
    }
  }}
/>
```

If `onSubmit` resolves successfully (no throw), PostComposer clears the body, audio, video, poll, and fires `onPollChange(null)`.

## Full Example

```tsx
import { PostComposer } from 'hive-react-kit';
import type { PollData } from 'hive-react-kit';

const ComposerPage = () => {
  const [pollData, setPollData] = useState<PollData | null>(null);

  return (
    <div className="max-w-2xl mx-auto p-4 bg-black min-h-screen">
      <PostComposer
        onSubmit={async (body) => {
          // body includes audio/video embed URLs appended
          console.log("Body:", body);
          console.log("Poll:", pollData);
          // Broadcast to Hive — throw on failure to preserve state
          await broadcastComment(body, pollData);
        }}
        onCancel={() => console.log("Cancelled")}
        currentUser="sagarkothari88"
        parentAuthor="shaktimaaan"
        placeholder="Write something in Markdown..."
        title="Create a Post"
        submitLabel="Publish"
        showCancel={true}
        defaultPreviewOn={false}
        // API tokens — omit any to hide that toolbar button
        ecencyToken={process.env.ECENCY_TOKEN}
        threeSpeakApiKey={process.env.THREE_SPEAK_API_KEY}
        giphyApiKey={process.env.GIPHY_API_KEY}
        templateToken={process.env.TEMPLATE_TOKEN}
        templateApiBaseUrl="https://my-api.com/data/templates"
        // Poll callback
        onPollChange={(poll) => setPollData(poll)}
        // Hide specific toolbar buttons
        hideCode
        hideMention
        // Appearance
        hideUserHeader={false}
        bgColor="#262b30"
        borderColor="#3a424a"
      />
    </div>
  );
};
```

## Controlled Mode Example

Use `value`, `onChange`, `hideSubmitArea`, and external buttons:

```tsx
const [body, setBody] = useState('');

const handleReply = async () => {
  try {
    await broadcastComment(body);
    setBody('');  // Clears textarea + audio/video (not poll)
  } catch (e) {
    toast.error(e.message);
    // Body preserved — user can retry
  }
};

<PostComposer
  value={body}
  onChange={setBody}
  onSubmit={handleReply}
  hideSubmitArea
  currentUser="myaccount"
/>
<button onClick={handleReply} disabled={!body.trim()}>Reply</button>
```

## Env Variables (Vite)

For the demo app, tokens are loaded from `.env`:

```env
VITE_ECENCY_TOKEN=your-ecency-token
VITE_THREE_SPEAK_API_KEY=your-3speak-key
VITE_GIPHY_API_KEY=your-giphy-key
VITE_TEMPLATE_TOKEN=your-jwt-token
VITE_TEMPLATE_API_BASE_URL=https://hreplier-api.sagarkothari88.one/data/templates
```

```tsx
<PostComposer
  ecencyToken={import.meta.env.VITE_ECENCY_TOKEN || undefined}
  threeSpeakApiKey={import.meta.env.VITE_THREE_SPEAK_API_KEY || undefined}
  giphyApiKey={import.meta.env.VITE_GIPHY_API_KEY || undefined}
  templateToken={import.meta.env.VITE_TEMPLATE_TOKEN || undefined}
  templateApiBaseUrl={import.meta.env.VITE_TEMPLATE_API_BASE_URL || undefined}
  // ...other props
/>
```

## Backward Compatibility

The old `AddCommentInput` name and `AddCommentInputProps` type are still exported as deprecated aliases:

```tsx
// Still works, but shows deprecation warning in IDE
import { AddCommentInput } from 'hive-react-kit';

// Preferred
import { PostComposer } from 'hive-react-kit';
```

## TypeScript

```tsx
import type { PostComposerProps, PollData } from 'hive-react-kit';

// Deprecated alias — still available
import type { AddCommentInputProps } from 'hive-react-kit';
```

## PollCreator (Standalone)

The poll creation modal is also exported for standalone use:

```tsx
import { PollCreator } from 'hive-react-kit';
import type { PollData, PollCreatorProps } from 'hive-react-kit';

<PollCreator
  isOpen={isPollOpen}
  onClose={() => setIsPollOpen(false)}
  onSave={(poll: PollData) => {
    console.log("Poll created:", poll);
    // poll.question, poll.choices, poll.end_time, etc.
  }}
  initialData={existingPoll}  // Pre-fill for editing
/>
```

### PollData Interface

```typescript
interface PollData {
  question: string;
  choices: string[];
  end_time: number;              // Unix timestamp (seconds)
  max_choices_voted: number;     // 1 to choices.length
  allow_vote_changes: boolean;
  filters: { account_age: number }; // Min account age in days
  ui_hide_res_until_voted: boolean;
}
```

## Template Service

The template API service is also exported for direct use:

```tsx
import { templateService } from 'hive-react-kit';
import type { TemplateModel } from 'hive-react-kit';

// Fetch templates
const templates = await templateService.getTemplates(token, apiBaseUrl);

// CRUD operations
await templateService.createTemplate(token, 'My Template', 'Hello {{author}}!', apiBaseUrl);
await templateService.updateTemplate(token, templateId, 'Updated', 'New body', apiBaseUrl);
await templateService.deleteTemplate(token, templateId, apiBaseUrl);
```
