# HiveDetailPost Component

A full-screen, single-column post detail view for Hive blockchain posts with inline comments, poll voting, parent post navigation, and content moderation. Renders post content via `@snapie/renderer` with a compact author header, action buttons, tags, payout info, and image captions.

## Features

- **Compact Author Header**: Sticky header with avatar, `@username`, reputation badge, and follower/following/posts stats
- **Full-Width Single Column**: Scrollable post content with no sidebar — optimized for reading
- **Hive Content Rendering**: Uses `@snapie/renderer` (`createHiveRenderer`) for safe markdown/HTML rendering with support for YouTube, 3Speak, IPFS, X.com embeds, images, code blocks, tables, and more
- **Image Captions**: Automatically displays `![title](url)` alt text as italic captions below images
- **Inline Comments**: Comments load directly below the post (no modal popup), with nested threaded replies, collapsible content, and inline reply composers
- **Comment Composer**: Always-visible composer for the post; inline reply composers open below specific comments when Reply is clicked
- **Poll Widget**: Full poll support with `max_choices_voted`, `allow_vote_changes`, and vote change flow
- **Parent Post Navigation**: "View parent post" button for replies (depth > 0) that pushes a browser route for back button support
- **Content Moderation**: Hide comments from reported authors or specific reported posts for the logged-in user
- **PostActionButton Integration**: Upvote, comment, reblog, share, tip, and report — clicking comment icon scrolls to inline comments instead of opening a modal
- **Observer Support**: `bridge.get_discussion` receives the logged-in user as `observer` for personalized vote data
- **Payout Display**: Accurate payout value with detailed tooltip (payout mode, time remaining, beneficiaries)
- **Skeleton Loading**: Animated placeholder UI while post and profile data load
- **Responsive Design**: Optimized for mobile and desktop
- **Dark Mode**: Full dark theme consistent with the rest of HiveReactKit

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

### Full Usage with React Router

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { HiveDetailPost } from 'hive-react-kit';

function PostPage() {
  const { author, permlink } = useParams<{ author: string; permlink: string }>();
  const navigate = useNavigate();

  if (!author || !permlink) return <p>Post not found</p>;

  return (
    <div style={{ height: '100vh' }}>
      <HiveDetailPost
        author={author}
        permlink={permlink}
        currentUser="myusername"
        onBack={() => navigate(-1)}
        onNavigateToPost={(a, p) => navigate(`/${a}/${p}`)}
        onUserClick={(user) => navigate(`/profile/${user}`)}
        onUpvote={(percent) => {
          console.log(`Upvote at ${percent}%`);
        }}
        onSubmitComment={(parentAuthor, parentPermlink, body) => {
          console.log("Comment:", parentAuthor, parentPermlink, body);
        }}
        onClickCommentUpvote={(cAuthor, cPermlink, percent) => {
          console.log(`Comment upvote: @${cAuthor}/${cPermlink} at ${percent}%`);
        }}
        onVotePoll={(pollAuthor, pollPermlink, choiceNums) => {
          console.log("Poll Vote:", pollAuthor, pollPermlink, choiceNums);
        }}
        onReblog={() => console.log("Reblog")}
        onShare={() => {
          navigator.clipboard.writeText(`https://peakd.com/@${author}/${permlink}`);
          alert("Link copied!");
        }}
        onTip={() => console.log("Tip")}
        onReport={() => console.log("Report")}
        onShareComment={(cAuthor, cPermlink) => {
          navigator.clipboard.writeText(`https://peakd.com/@${cAuthor}/${cPermlink}`);
          console.log("Share comment:", cAuthor, cPermlink);
        }}
        onTipComment={(cAuthor, cPermlink) => {
          console.log("Tip comment author:", cAuthor, cPermlink);
        }}
        onReportComment={(cAuthor, cPermlink) => {
          console.log("Report comment:", cAuthor, cPermlink);
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

### With Content Moderation

```tsx
<HiveDetailPost
  author="someauthor"
  permlink="some-post"
  currentUser="sagarkothari88"
  reportedAuthors={["spammer1", "spammer2"]}
  reportedPosts={[
    { author: "baduser", permlink: "bad-post-permlink" },
    { author: "another", permlink: "reported-comment" },
  ]}
/>
```

Comments from `reportedAuthors` and comments matching `reportedPosts` are hidden **only** for the `currentUser`. Other users who don't pass these arrays see all comments normally.

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
        onNavigateToPost={(a, p) => navigate(`/${a}/${p}`)}
        onUserClick={(user) => navigate(`/profile/${user}`)}
        onUpvote={(percent) => console.log("Upvote:", percent)}
        onSubmitComment={(pA, pP, body) => console.log("Comment:", body)}
        onVotePoll={(a, p, choices) => console.log("Poll:", a, p, choices)}
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

### Core

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `author` | `string` | *required* | Hive account name of the post author |
| `permlink` | `string` | *required* | Permlink of the post |
| `currentUser` | `string` | `undefined` | Currently logged-in username. Required for upvote/comment/reblog/poll actions and content moderation |

### Action Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onUpvote` | `(percent: number) => void \| Promise<void>` | Called when user confirms upvote with vote weight (1-100). Frontend handles signing/broadcast. |
| `onSubmitComment` | `(parentAuthor: string, parentPermlink: string, body: string) => void \| Promise<void>` | Called when user submits a comment or reply. Frontend handles signing/broadcast. |
| `onClickCommentUpvote` | `(author: string, permlink: string, percent: number) => void \| Promise<void>` | Called when user upvotes a comment. |
| `onVotePoll` | `(author: string, permlink: string, choiceNums: number[]) => void \| Promise<void>` | Called when user votes on a poll. `choiceNums` are 1-based choice numbers. |
| `onReblog` | `() => void` | Called when reblog button is clicked. |
| `onShare` | `() => void` | Called when share is clicked. Falls back to Web Share API / clipboard copy if not provided. |
| `onTip` | `() => void` | Called when tip button is clicked. |
| `onReport` | `() => void` | Called when report button is clicked. |
| `onShareComment` | `(author: string, permlink: string) => void` | Called when share is clicked on an inline comment. |
| `onTipComment` | `(author: string, permlink: string) => void` | Called when tip is clicked on an inline comment. |
| `onReportComment` | `(author: string, permlink: string) => void` | Called when report is clicked on an inline comment. |

### Navigation

| Prop | Type | Description |
|------|------|-------------|
| `onBack` | `() => void` | Called when back button is clicked. If not provided, back button is hidden. |
| `onUserClick` | `(username: string) => void` | Called when a username/avatar is clicked. |
| `onNavigateToPost` | `(author: string, permlink: string) => void` | Called when "View parent post" is clicked. Wire to `navigate()` for browser history support. |

### Content Moderation

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `reportedAuthors` | `string[]` | `undefined` | Usernames whose comments are hidden for `currentUser`. Case-insensitive. |
| `reportedPosts` | `{ author: string; permlink: string }[]` | `undefined` | Specific posts/comments to hide for `currentUser`. Case-insensitive matching. |

### Composer Tokens

| Prop | Type | Description |
|------|------|-------------|
| `ecencyToken` | `string` | Ecency image hosting token — enables image upload, paste, and drag-drop in comment composer |
| `threeSpeakApiKey` | `string` | 3Speak API key — enables audio/video upload in comment composer |
| `giphyApiKey` | `string` | GIPHY API key — enables GIF search in comment composer |
| `templateToken` | `string` | HReplier API token — enables template picker in comment composer |
| `templateApiBaseUrl` | `string` | Custom template API endpoint |

### Theming

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hiveIconUrl` | `string` | `"/images/hive_logo.png"` | URL to Hive logo icon shown next to payout value |
| `backgroundColor` | `string \| string[]` | `undefined` (gray-900) | Background color. Single string for solid, array for gradient (top to bottom) |

## Content translation (i18n)

When this component renders inside a `<HiveLanguageProvider>` with a non-English `language`, the following user-generated text is translated automatically:

- **Post title** (the H1 heading).
- **Post body** (rendered HTML — text nodes only; embeds, code blocks, image src/alt-tags-as-attributes are preserved).
- **Every inline comment body** rendered by `InlineCommentItem` (full thread, including replies opened by the comment composer).

```tsx
import { HiveLanguageProvider } from 'hive-react-kit'

<HiveLanguageProvider language="es">
  <HiveDetailPost author="alice" permlink="hello-world" />
</HiveLanguageProvider>
```

Defaults to `"en"` (no-op). See [i18n.md](i18n.md) for the full provider API, custom-translator integration (DeepL / Google / your own), and caching behaviour.

## Inline Comments

Comments are rendered inline below the post content using `InlineCommentSection` and `InlineCommentItem` components. Clicking the comment icon in the action bar scrolls to the comments section instead of opening a modal.

### Comment Features

- **Always-visible composer** at top of comments section for replying to the post
- **Inline reply composers** open directly below the target comment when Reply is clicked — the top composer stays visible
- **Mobile reply composer**: On mobile, the inline reply composer renders as a fixed bottom sheet overlay instead of being nested inline (prevents overflow at deep nesting levels)
- **Composer header** shows both avatars: `@currentUser replying to @targetAuthor/permlink`
- **Self-reply detection**: When replying to your own post/comment, your avatar shows only once with "commenting on your post" or "replying to your comment"
- **@ mention button** auto-inserts `@targetAuthor ` when clicked inside a reply composer (uses `parentAuthor` prop)
- **Collapsible comments**: Chevron toggle to minimize long content — collapsed preview shows **plain text** (HTML tags and markdown syntax stripped)
- **Comment action buttons**: Each comment shows Share, Report, Tip icons and Hive payout value alongside Upvote and Reply. Report/Tip only visible for other users' comments (not your own).
- **Nested replies** up to depth 4, with clickable "View X more replies" button to expand deeper threads
- **Search bar** to filter comments by body text or author name
- **Hive Content Renderer**: Comment bodies rendered with `createHiveRenderer` from `@snapie/renderer`
- **No auto-focus**: The top-level composer does not auto-focus on mount, preventing scroll jump on page navigation
- **Mobile responsive**: Reduced nesting indentation, wrapping action buttons, hidden timestamps on small screens, smaller avatars

### Comment Composer Behavior

| State | Top Composer | Inline Composer |
|-------|-------------|-----------------|
| No reply active | Visible (reply to post author) | Hidden |
| Reply to a comment | Still visible | Opens below target comment |
| Submit / Cancel reply | Still visible | Closes |

### Content Moderation in Comments

When `reportedAuthors` or `reportedPosts` are provided and `currentUser` is set:
- Comments from reported authors are filtered out from the comment list
- Comments matching reported `author/permlink` pairs are filtered out
- Uses `Set` lookups with case-insensitive matching for performance
- Other users without these props see all comments normally

## Poll Widget

The poll widget renders when the post has `content_type: "poll"` in its `json_metadata`.

### Poll Features

- **Single and multi-choice polls** based on `max_choices_voted`
- **Progress bars** showing vote percentage per choice
- **End time** displayed as "Ends in Xd" or "Ended"
- **Vote callback**: `onVotePoll(author, permlink, choiceNums)` where `choiceNums` is an array of 1-based choice numbers

### Vote Change Support (`allow_vote_changes`)

When `allow_vote_changes` is `true` and the user has already voted:

| Aspect | Behavior |
|--------|----------|
| Previous choices | Shown in dimmed green (old vote indicator), clickable to re-select |
| New selections | Shown in blue, same as fresh votes |
| Max choices | Still capped at `max_choices_voted` |
| Single-choice poll | Requires explicit submit button click (no auto-submit), so user can deliberate |
| Hint text | Shows "Change your vote — Select up to N option(s)" |
| Submit button | Label changes to "Change Vote" |
| Footer | Shows "Voted . Vote changes allowed" |

### Poll Data Flow

```
User clicks choice(s) → handleChoiceClick() → selectedChoices state updated
                                               ↓
            Single choice (first vote) → auto-submits via onVotePoll
            Multi choice or vote change → user clicks Submit/Change Vote button
                                               ↓
                                         onVotePoll(author, permlink, [choiceNums])
```

## Parent Post Navigation

When the post has `depth > 0` (it's a reply/comment), a "View parent post" button appears above the title.

### How It Works

1. Button displays: **View parent post** `@parent_author/parent_permlink`
2. On click, calls `onNavigateToPost(parent_author, parent_permlink)`
3. When wired to `navigate(`/${a}/${p}`)`, this pushes a new route onto browser history
4. The browser back button (or `onBack` with `navigate(-1)`) returns to the original post
5. The new route renders a fresh `HiveDetailPost` with the parent's author/permlink, loading its full content, comments, and poll

### Example

```tsx
<HiveDetailPost
  author={author}
  permlink={permlink}
  onBack={() => navigate(-1)}
  onNavigateToPost={(a, p) => navigate(`/${a}/${p}`)}
/>
```

## Background Color Examples

```tsx
// Default (dark gray-900)
<HiveDetailPost author="user" permlink="post" />

// Solid color
<HiveDetailPost author="user" permlink="post" backgroundColor="#1a1a2e" />

// Two-color gradient (top to bottom)
<HiveDetailPost author="user" permlink="post" backgroundColor={["#0f172a", "#1e293b"]} />

// Three-color gradient
<HiveDetailPost author="user" permlink="post" backgroundColor={["#1a1a2e", "#16213e", "#0f3460"]} />
```

When `backgroundColor` is provided:
- **Single string** -> applied as a solid `background` to the container
- **Array with 1 color** -> solid background using that color
- **Array with 2+ colors** -> `linear-gradient(to bottom, color1, color2, ...)` applied to the container
- The sticky header uses the first color (or the single color) for a consistent look

## Component Layout

```
+--------------------------------------------------+
| [<] [Avatar] @author (rep)                       |  <- Sticky header
|              123 Followers  45 Following  67 Posts|
+--------------------------------------------------+
|                                                  |
|  [View parent post @parent/permlink]             |  <- Only if depth > 0
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
|  [Poll Widget - if content_type is poll]         |
|  ------------------------------------------------|
|  Tags: #hive #reactkit #dev                      |
|  ------------------------------------------------|
|  [Upvote] 42  [Comment] 12  ...       $8.500    |  <- Bottom action bar
|  ------------------------------------------------|
|                                                  |
|  Comments (12)                    [Search] [Refresh]
|  +--------------------------------------------+ |
|  | [avatar] @you replying to [avatar] @author | |  <- Always-visible composer
|  | [textarea] [toolbar] [Post]                | |
|  +--------------------------------------------+ |
|                                                  |
|  [avatar] @user1              2 hours ago    [v] |  <- Comment (collapsible)
|     Comment body rendered with Hive renderer...  |
|     [Up 3] [Reply] [Share] [Report] [Tip]        |
|     [2 replies]                        $0.039 H  |  <- Actions wrap on mobile
|     +------------------------------------------+ |  <- Inline reply composer
|     | @you replying to @user1/permlink    [x]  | |     (desktop: inline)
|     | [textarea] [toolbar] [Post]              | |     (mobile: fixed bottom sheet)
|     +------------------------------------------+ |
|        [avatar] @user2  (nested reply, depth 1)  |
|           Reply body...                          |
|           [Up] [Reply] [Share] [Tip] $0.010 H    |
|              [avatar] @user3  (depth 2)          |
|                 ...                              |
|                                                  |
|  [avatar] @user4              5 hours ago    [v] |  <- Another top-level comment
|     ...                                          |
|                                                  |
|  [v] @user5  nice post about hive...             |  <- Collapsed (plain text preview)
+--------------------------------------------------+
```

## Mobile Responsiveness

The inline comments system is fully responsive for mobile devices:

| Element | Mobile (< md) | Desktop (>= md) |
|---------|--------------|-----------------|
| Nesting indentation | `ml-2 pl-2` per depth | `ml-6 pl-4` per depth |
| Avatar size | `w-6 h-6` | `w-7 h-7` |
| Username | `text-xs`, truncated | `text-sm` |
| Timestamp | Hidden | Visible |
| Action buttons | Wrap into multiple rows via `flex-wrap` | Single row |
| "Show/Hide" text | Hidden (only count shown, e.g. "2 replies") | Full text ("Show 2 replies") |
| Body/action left margin | `ml-7` | `ml-9` |
| Reply composer | Fixed bottom sheet overlay (`max-h-[70vh]`, dark backdrop) | Inline below the comment |
| Payout value | Smaller text (`text-[11px]`), `w-3 h-3` icon | Standard size |
| Collapsed preview | Plain text, truncated to 120 chars | Same |

### Collapsed Comment Preview

When a comment is collapsed, the preview strips all HTML tags and markdown syntax to show clean plain text:
- HTML tags (`<p>`, `<img>`, `<a>`, etc.) are removed
- Markdown images (`![alt](url)`) are removed
- Markdown links show only the link text
- Formatting characters (`#`, `*`, `_`, `~`, `` ` ``, `>`) are stripped
- Whitespace is collapsed

Example: `<p>nice post!</p>` shows as `nice post!`

## Content Rendering

The component uses `@snapie/renderer` (`createHiveRenderer`) for both post body and comment body rendering. Supported content types:

- Markdown headings, paragraphs, bold, italic, lists
- Images (with automatic figcaption from alt text)
- Code blocks and inline code
- Blockquotes and tables
- Horizontal rules
- Links (with `nofollow` and `target="_blank"`)
- Video embeds (YouTube, 3Speak with `play.3speak.tv` upgrade, Vimeo)
- IPFS content (via `ipfs.3speak.tv` gateway)
- X.com embeds
- Hive URL conversion

## API Integration

The component fetches data from the following Hive APIs:

- `condenser_api.get_content` — Post content (title, body, votes, metadata, payout, depth, parent info)
- `bridge.get_discussion` — Comments list with `observer` parameter for personalized vote data
- `condenser_api.get_follow_count` — Author profile stats
- Poll API — Fetch poll details (`getPollDetail`) including `allow_vote_changes` and `max_choices_voted`

## File Structure

```
src/components/
  HiveDetailPost.tsx                 — Main post detail component
  inlineComments/
    InlineCommentSection.tsx          — Comment list container with top composer, search, moderation
    InlineCommentItem.tsx             — Individual comment with collapse, inline reply, vote
  actionButtons/
    PostActionButton.tsx              — Action bar (disableCommentsModal mode for inline comments)
  comments/
    AddCommentInput.tsx               — PostComposer (rich markdown editor, disableAutoFocus support)
src/pages/
  HiveDetailPostPage.tsx              — Page wrapper with React Router integration
```

## States

| State | Description |
|-------|-------------|
| **Loading** | Animated skeleton placeholder mimicking the final layout |
| **Error** | Error message with a "Try Again" button to retry the fetch |
| **Loaded** | Full post content with header, action buttons, body, poll, tags, and inline comments |

## Dependencies

- React 16.8+
- Tailwind CSS
- Lucide React (icons)
- `@snapie/renderer` (Hive content rendering for post body and comments)
- `date-fns` (time formatting in comments)
- Hive API access
