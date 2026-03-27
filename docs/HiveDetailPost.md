# HiveDetailPost Component

A full-screen, single-column post detail view for Hive blockchain posts. Displays post content rendered via `@hiveio/content-renderer` with a compact author header, action buttons (upvote, comment, reblog, share, tip, report), tags, payout info, and image captions. Follows the same UI patterns as `UserDetailProfile`.

## Features

- **Compact Author Header**: Sticky header with avatar, `@username`, reputation badge, and follower/following/posts stats (same pattern as `UserDetailProfile`)
- **Full-Width Single Column**: Scrollable post content with no sidebar — optimized for reading
- **Hive Content Rendering**: Uses `@hiveio/content-renderer` (`DefaultRenderer`) for safe markdown/HTML rendering with support for images, videos, embeds, code blocks, tables, and IPFS content
- **Image Captions**: Automatically displays `![title](url)` alt text as italic captions below images
- **PostActionButton Integration**: Upvote, comment, reblog, share, tip, and report — all via the shared `PostActionButton` component
- **Payout Display**: Accurate payout value with detailed tooltip (payout mode, time remaining, beneficiaries) matching `UserDetailProfile` logic
- **Skeleton Loading**: Animated placeholder UI while post and profile data load
- **Responsive Design**: Optimized for mobile and desktop with responsive typography and spacing
- **Dark Mode**: Full dark theme consistent with the rest of HiveReactKit
- **Comment Composer Tokens**: Supports Ecency image upload, 3Speak audio/video, GIPHY, and HReplier templates

## Installation

```bash
npm install hive-react-kit
```

## Usage

### Basic Usage

```tsx
import { HiveDetailPost } from 'hive-react-kit';

function App() {
  return (
    <HiveDetailPost
      author="sagarkothari88"
      permlink="my-first-post"
      currentUser="myusername"
      onUpvote={(percent) => console.log("Upvote:", percent)}
      onSubmitComment={(pAuthor, pPermlink, body) => console.log("Comment:", body)}
    />
  );
}
```

### Full Usage with All Callbacks

```tsx
import { HiveDetailPost } from 'hive-react-kit';
import { useNavigate } from 'react-router-dom';

function PostPage({ author, permlink }: { author: string; permlink: string }) {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100vh' }}>
      <HiveDetailPost
        author={author}
        permlink={permlink}
        currentUser="myusername"
        onBack={() => navigate(-1)}
        onUserClick={(user) => navigate(`/profile/${user}`)}
        onUpvote={(percent) => {
          // Integrate with Aioha / HiveKeychain
          console.log(`Upvote at ${percent}%`);
        }}
        onSubmitComment={(parentAuthor, parentPermlink, body) => {
          // Broadcast comment via HiveKeychain
          console.log("Comment:", parentAuthor, parentPermlink, body);
        }}
        onClickCommentUpvote={(cAuthor, cPermlink, percent) => {
          console.log(`Comment upvote: @${cAuthor}/${cPermlink} at ${percent}%`);
        }}
        onReblog={() => {
          console.log("Reblog");
        }}
        onShare={() => {
          navigator.clipboard.writeText(`https://peakd.com/@${author}/${permlink}`);
          alert("Link copied!");
        }}
        onTip={() => {
          console.log("Tip author");
        }}
        onReport={() => {
          console.log("Report post");
        }}
        ecencyToken="your-ecency-token"
        threeSpeakApiKey="your-3speak-key"
        giphyApiKey="your-giphy-key"
        templateToken="your-template-token"
        templateApiBaseUrl="https://your-api.com/templates"
      />
    </div>
  );
}
```

### Route-Based Usage

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HiveDetailPostPage from './pages/HiveDetailPostPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:author/:permlink" element={<HiveDetailPostPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// pages/HiveDetailPostPage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { HiveDetailPost } from 'hive-react-kit';

export default function HiveDetailPostPage() {
  const { author, permlink } = useParams<{ author: string; permlink: string }>();
  const navigate = useNavigate();

  if (!author || !permlink) return <p>Post not found</p>;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <HiveDetailPost
        author={author}
        permlink={permlink}
        currentUser="myusername"
        onBack={() => navigate(-1)}
        onUserClick={(user) => navigate(`/profile/${user}`)}
        onUpvote={(percent) => console.log("Upvote:", percent)}
        onSubmitComment={(pA, pP, body) => console.log("Comment:", body)}
        onReblog={() => console.log("Reblog")}
        onShare={() => console.log("Share")}
        onTip={() => console.log("Tip")}
        onReport={() => console.log("Report")}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `author` | `string` | *required* | Hive account name of the post author |
| `permlink` | `string` | *required* | Permlink of the post |
| `currentUser` | `string` | `undefined` | Currently logged-in username. Required for upvote/comment/reblog actions |
| `onUpvote` | `(percent: number) => void \| Promise<void>` | `undefined` | Called when user confirms upvote with vote weight (1-100). Frontend handles signing/broadcast |
| `onSubmitComment` | `(parentAuthor: string, parentPermlink: string, body: string) => void \| Promise<void>` | `undefined` | Called when user submits a comment. Frontend handles signing/broadcast |
| `onClickCommentUpvote` | `(author: string, permlink: string, percent: number) => void \| Promise<void>` | `undefined` | Called when user upvotes a comment inside the comments modal |
| `onReblog` | `() => void` | `undefined` | Called when reblog button is clicked |
| `onShare` | `() => void` | `undefined` | Called when share button is clicked. Falls back to Web Share API / clipboard if not provided |
| `onTip` | `() => void` | `undefined` | Called when tip button is clicked |
| `onReport` | `() => void` | `undefined` | Called when report button is clicked |
| `onBack` | `() => void` | `undefined` | Called when back arrow is clicked. If not provided, back button is hidden |
| `onUserClick` | `(username: string) => void` | `undefined` | Called when author avatar or username is clicked in the header |
| `ecencyToken` | `string` | `undefined` | Ecency image hosting token — enables image upload in comment composer |
| `threeSpeakApiKey` | `string` | `undefined` | 3Speak API key — enables audio/video upload in comment composer |
| `giphyApiKey` | `string` | `undefined` | GIPHY API key — enables GIF search in comment composer |
| `templateToken` | `string` | `undefined` | HReplier API token — enables template picker in comment composer |
| `templateApiBaseUrl` | `string` | `undefined` | Custom template API endpoint |

## Component Layout

```
+--------------------------------------------------+
| [<] [Avatar] @author (rep)                       |  <- Sticky header
|              123 Followers  45 Following  67 Posts|
+--------------------------------------------------+
|                                                  |
|  Post Title                                      |
|  Mar 27, 2026 in Community Name                  |
|                                                  |
|  [Upvote] 42  [Comment] 12  [Reblog] [Share]    |  <- PostActionButton
|  [Report] [Tip]                        $8.500    |
|  ------------------------------------------------|
|                                                  |
|  Rendered post body...                           |
|  (headings, paragraphs, images with captions,    |
|   code blocks, blockquotes, embeds, tables)      |
|                                                  |
|  ------------------------------------------------|
|  Tags: #hive #reactkit #dev                      |
|  ------------------------------------------------|
|  [Upvote] 42  [Comment] 12  ...       $8.500    |  <- Bottom action bar
+--------------------------------------------------+
```

## Content Rendering

The component uses `@hiveio/content-renderer` (`DefaultRenderer`) to safely render Hive post content. Supported content types:

- Markdown headings, paragraphs, bold, italic, lists
- Images (with automatic figcaption from alt text)
- Code blocks and inline code
- Blockquotes
- Tables
- Horizontal rules
- Links (with `nofollow` and `target="_blank"`)
- Video embeds (YouTube, Vimeo, 3Speak, etc.)
- IPFS content (via configurable gateway)

### Image Captions

When a post contains `![caption text](image-url)`, the component automatically renders a styled caption below the image:

```
+----------------------------+
|         [Image]            |
|    caption text (italic)   |
+----------------------------+
```

## CSS Requirements

The component requires the `.hive-post-body` CSS class for rendered content styling. These styles are included in the library's CSS bundle (`build.css`). If you are using the library's stylesheet, no additional setup is needed.

If you need to customize the body styles, override the `.hive-post-body` selectors in your CSS.

## API Integration

The component fetches data from the following Hive APIs:

- `bridge.get_post` — Post content (title, body, votes, metadata, payout)
- `bridge.get_profile` — Author profile (name, avatar, followers, reputation)

## States

| State | Description |
|-------|-------------|
| **Loading** | Animated skeleton placeholder mimicking the final layout (header, title, action bar, body paragraphs, images, tags) |
| **Error** | Error message with a "Try Again" button to retry the fetch |
| **Loaded** | Full post content with author header, action buttons, rendered body, and tags |

## Payout Tooltip

The payout tooltip displays detailed information matching Hive standard format:

- Payout mode (100% Power Up or 50%/50% split)
- Time remaining until payout (e.g. "in 5 days 12 hours")
- Past payout amounts (for already-paid posts)
- Beneficiary splits (account name + percentage)

## Dependencies

- React 16.8+
- Tailwind CSS
- Lucide React (for icons)
- `@hiveio/content-renderer` (for body rendering)
- `PostActionButton` (internal component)
- Hive API access
