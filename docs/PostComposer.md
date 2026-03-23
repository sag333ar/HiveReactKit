# PostComposer

A rich markdown composer component with live preview, media upload (image, audio, video), paste/drag-drop image upload, GIF search, emoji picker, template picker, code block support with copy-to-clipboard, and @ mention.

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
| `onSubmit` | `(body: string) => void` | Yes | - | Called with the final markdown body (includes audio/video embed URLs appended) |
| `onCancel` | `() => void` | No | - | Called when Cancel button is clicked or Escape is pressed |
| `currentUser` | `string` | No | `undefined` | Hive username. Shows avatar and `@username` in the header |
| `placeholder` | `string` | No | `"Write in Markdown..."` | Textarea placeholder text |
| `parentAuthor` | `string` | No | `undefined` | Shows "Replying to @author" in header. Used by @ mention button |
| `parentPermlink` | `string` | No | `undefined` | Parent permlink for context |
| `title` | `string` | No | `undefined` | Optional title displayed above the composer |
| `submitLabel` | `string` | No | `"Post"` | Label for the submit button |
| `showCancel` | `boolean` | No | `true` | Show/hide the Cancel button |
| `defaultPreviewOn` | `boolean` | No | `false` | Whether the live preview is visible by default |

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

## Layout

The component renders in this order (top to bottom):

1. **Title** (optional)
2. **User header** — avatar + username + "Replying to" line
3. **Live preview** — rendered markdown via `@snapie/renderer` (toggleable)
4. **Audio attachment preview** — with remove button (shown after upload)
5. **Video attachment preview** — with remove button (shown after upload)
6. **Toolbar** — formatting, upload, emoji, GIF, template buttons
7. **Textarea** — with paste/drag-drop support
8. **Actions** — keyboard hint, Cancel, Submit

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

## Full Example

```tsx
import { PostComposer } from 'hive-react-kit';

const ComposerPage = () => (
  <div className="max-w-2xl mx-auto p-4 bg-black min-h-screen">
    <PostComposer
      onSubmit={(body) => {
        console.log("Body:", body);
        // Broadcast comment via HiveKeychain/Aioha
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
      // Hide specific toolbar buttons
      hideAudio={true}
      hideVideo={true}
    />
  </div>
);
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
import type { PostComposerProps } from 'hive-react-kit';

// Deprecated alias — still available
import type { AddCommentInputProps } from 'hive-react-kit';
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
