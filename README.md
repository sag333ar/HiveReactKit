# Hive React Kit

A comprehensive React component library for building Hive blockchain applications with modern UI components.

## Features

- 🎨 **Modern UI Components** - Built with shadcn/ui and Radix UI primitives
- 🔗 **Hive Integration** - Ready-to-use components for Hive blockchain
- 📱 **Responsive Design** - Mobile-first approach with Tailwind CSS
- 🎯 **TypeScript Support** - Full TypeScript support with type definitions
- 🚀 **Tree Shaking** - Optimized bundle size with tree shaking support
- 🎭 **Customizable** - Easy to customize and extend

## Installation

```bash
npm install hive-react-kit
# or
yarn add hive-react-kit
# or
pnpm add hive-react-kit
```

## Usage

### Basic Import

```tsx
import { VideoCard, VideoFeed, Wallet } from 'hive-react-kit';
```

### UI Components

```tsx
import { Button, Card, Input } from 'hive-react-kit/ui';
```

### Hooks

```tsx
import { useMobile } from 'hive-react-kit/hooks';
```

### Types

```tsx
import type { Video, Comment, Wallet as WalletType } from 'hive-react-kit/types';
```

## Components

### Main Components

- **VideoCard** - Display video content with metadata
- **VideoFeed** - Feed of videos with pagination
- **VideoDetail** - Detailed video view
- **VideoInfo** - Video information display
- **Wallet** - Hive wallet integration
- **HiveDetailPost** - Full-screen post detail view with content rendering, action buttons, and author header

### Community Components

- **CommunitiesList** - List of communities
- **CommunityDetail** - Community details
- **CommunityAbout** - Community about section
- **CommunityMembers** - Community members list
- **CommunityTeam** - Community team members

### Composer Components

- **PostComposer** - Rich markdown composer with live preview (@snapie/renderer), image/audio/video upload, paste & drag-drop, GIF search, emoji picker (500+, 9 categories), template picker, code blocks with copy, and @ mention. See [PostComposer docs](docs/PostComposer.md)

### Modal Components

- **CommentsModal** - Comments display modal
- **DescriptionModal** - Description editing modal
- **UpvoteListModal** - Upvote list modal
- **Modal** - Base modal component

### User Components

- **UserDetailProfile** - Full-featured user profile with 12 configurable tabs, action callbacks, and infinite scroll
- **UserAccount** - User account management
- **UserProfilePage** - User profile page
- **UserInfo** - User information display
- **UserFollowers** - User followers list
- **UserFollowing** - User following list

#### UserDetailProfile Usage

```tsx
import { UserDetailProfile } from 'hive-react-kit';

// All tabs, default order, with rich comment composer
<UserDetailProfile
  username="sagarkothari88"
  currentUsername="myaccount"
  showBackButton
  ecencyToken="your-ecency-token"
  threeSpeakApiKey="your-3speak-api-key"
  giphyApiKey="your-giphy-api-key"
  templateToken="your-jwt-token"
  templateApiBaseUrl="https://your-api.com/data/templates"
  onBack={() => navigate(-1)}
  onFollow={(user) => console.log("Follow:", user)}
  onUnfollow={(user) => console.log("Unfollow:", user)}
  onPostClick={(author, permlink, title) => navigate(`/post/${author}/${permlink}`)}
  onUserClick={(user) => navigate(`/profile/${user}`)}
/>

// Custom tabs: only show 4 tabs, Wallet first
<UserDetailProfile
  username="sagarkothari88"
  tabShown={["wallet", "blogs", "followers", "following"]}
  onPostClick={(author, permlink) => console.log(author, permlink)}
/>
```

#### UserDetailProfile Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `username` | `string` | *required* | Hive username to display |
| `currentUsername` | `string` | `undefined` | Logged-in user's username. Enables follow/unfollow and action menu |
| `showBackButton` | `boolean` | `false` | Show back arrow in header |
| `onBack` | `() => void` | - | Callback when back button is clicked |
| `tabShown` | `TabType[]` | all tabs | Controls which tabs are visible and their order. Only listed tabs are shown. First tab is the default active tab. If omitted, all 12 tabs are shown in default order |
| `ecencyToken` | `string` | `undefined` | Ecency image hosting token. Enables image upload, video thumbnail upload, and paste/drag-drop image upload. Hidden when not provided |
| `threeSpeakApiKey` | `string` | `undefined` | 3Speak API key. Enables audio recording/upload and video upload (TUS protocol). Hidden when not provided |
| `giphyApiKey` | `string` | `undefined` | GIPHY API key. Enables GIF search. Hidden when not provided |
| `templateToken` | `string` | `undefined` | HReplier API JWT token. Enables template picker. Hidden when not provided |
| `templateApiBaseUrl` | `string` | `https://hreplier-api...` | Custom template API endpoint. Override when self-hosting |

**Social Action Callbacks**

| Prop | Type | Description |
|------|------|-------------|
| `onFollow` | `(username: string) => void` | Called when Follow is clicked from the action menu |
| `onUnfollow` | `(username: string) => void` | Called when Unfollow is clicked from the action menu |
| `onIgnoreAuthor` | `(username: string) => void` | Called when Ignore Author is confirmed |
| `onReportUser` | `(username: string, reason: string) => void` | Called when Report is submitted with selected reason |

**Post Action Callbacks (via PostActionButton)**

| Prop | Type | Description |
|------|------|-------------|
| `onUpvote` | `(author: string, permlink: string, percent: number) => void` | Called when a post/comment is upvoted via the vote slider |
| `onSubmitComment` | `(parentAuthor: string, parentPermlink: string, body: string) => void` | Called when a comment is submitted |
| `onClickCommentUpvote` | `(author: string, permlink: string, percent: number) => void` | Called when a comment inside the comments modal is upvoted |
| `onReblog` | `(author: string, permlink: string) => void` | Called when reblog is clicked |
| `onTip` | `(author: string, permlink: string) => void` | Called when tip is clicked |
| `onReportPost` | `(author: string, permlink: string) => void` | Called when a post is reported |

**Navigation Callbacks**

| Prop | Type | Description |
|------|------|-------------|
| `onUserClick` | `(username: string) => void` | Called when a user avatar/name is clicked (followers, following, etc.) |
| `onPostClick` | `(author: string, permlink: string, title: string) => void` | Called when a blog/post/reward row is clicked |
| `onSnapClick` | `(author: string, permlink: string) => void` | Called when a snap item is clicked |
| `onPollClick` | `(author: string, permlink: string, question: string) => void` | Called when a poll item is clicked |
| `onActivityPermlink` | `(author: string, permlink: string) => void` | Called when an activity permlink is clicked |
| `onActivitySelect` | `(activity: any) => void` | Called when an activity item is selected |
| `onShare` | `(username: string) => void` | Called when the share button is clicked |

#### TabType Values

The `tabShown` prop accepts an array of these values:

| Value | Tab Label | Description |
|-------|-----------|-------------|
| `"blogs"` | Blogs | User's blog posts (reblogs included) |
| `"posts"` | Posts | User's original posts |
| `"snaps"` | Snaps | User's snaps from PeakD |
| `"polls"` | Polls | User's polls from HiveHub |
| `"comments"` | Comments | User's comments |
| `"replies"` | Replies | Replies to the user |
| `"activities"` | Activities | User's activity history |
| `"authorRewards"` | Author Rewards | Pending author rewards (posts/comments with upcoming payouts) |
| `"curationRewards"` | Curation Rewards | Pending curation rewards (estimated from vote history) |
| `"followers"` | Followers | User's followers list |
| `"following"` | Following | Accounts the user follows |
| `"wallet"` | Wallet | User's HIVE/HBD/HP balances |

#### tabShown Examples

```tsx
// Show all tabs (default when tabShown is omitted)
<UserDetailProfile username="user" />

// Only Blogs and Wallet
<UserDetailProfile username="user" tabShown={["blogs", "wallet"]} />

// Followers first, then Blogs, then Wallet — no other tabs
<UserDetailProfile
  username="user"
  tabShown={["followers", "following", "blogs", "wallet"]}
/>

// Everything except Snaps and Polls
<UserDetailProfile
  username="user"
  tabShown={[
    "blogs", "posts", "comments", "replies",
    "activities", "authorRewards", "curationRewards",
    "followers", "following", "wallet"
  ]}
/>
```

See [docs/UserDetailProfile.md](docs/UserDetailProfile.md) for full documentation including all callbacks, tab types, streaming behavior, and styling details.

### HiveDetailPost

A full-screen, single-column post detail view. Renders Hive post content using `@hiveio/content-renderer` with a compact author header (avatar, username, reputation, follower/following/posts stats), `PostActionButton` for all interactions, image captions from alt text, tags, and payout info.

#### HiveDetailPost Usage

```tsx
import { HiveDetailPost } from 'hive-react-kit';

// Basic
<HiveDetailPost
  author="sagarkothari88"
  permlink="my-first-post"
  currentUser="myusername"
  onUpvote={(percent) => console.log("Upvote:", percent)}
  onSubmitComment={(pAuthor, pPermlink, body) => console.log("Comment:", body)}
/>

// Custom gradient background
<HiveDetailPost
  author="sagarkothari88"
  permlink="my-first-post"
  backgroundColor={["#0f172a", "#1e293b", "#0f3460"]}
  onUpvote={(percent) => console.log("Upvote:", percent)}
/>

// Full usage with all callbacks
<HiveDetailPost
  author="sagarkothari88"
  permlink="my-first-post"
  currentUser="myusername"
  onBack={() => navigate(-1)}
  onUserClick={(user) => navigate(`/profile/${user}`)}
  onUpvote={(percent) => console.log("Upvote:", percent)}
  onSubmitComment={(pAuthor, pPermlink, body) => console.log("Comment:", body)}
  onClickCommentUpvote={(a, p, pct) => console.log("Comment upvote:", a, p, pct)}
  onReblog={() => console.log("Reblog")}
  onShare={() => navigator.clipboard.writeText(`https://peakd.com/@${author}/${permlink}`)}
  onTip={() => console.log("Tip")}
  onReport={() => console.log("Report")}
  ecencyToken="your-ecency-token"
  threeSpeakApiKey="your-3speak-key"
  giphyApiKey="your-giphy-key"
  templateToken="your-template-token"
/>
```

#### HiveDetailPost Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `author` | `string` | *required* | Hive account name of the post author |
| `permlink` | `string` | *required* | Permlink of the post |
| `currentUser` | `string` | `undefined` | Logged-in username. Required for upvote/comment/reblog |
| `backgroundColor` | `string \| string[]` | `undefined` (gray-900) | Single color for solid bg, or array of colors for gradient |
| `onBack` | `() => void` | `undefined` | Back button callback. Hidden when not provided |
| `onUserClick` | `(username: string) => void` | `undefined` | Called when author avatar/name is clicked |

**Post Action Callbacks (via PostActionButton)**

| Prop | Type | Description |
|------|------|-------------|
| `onUpvote` | `(percent: number) => void \| Promise<void>` | Called when user confirms upvote with vote weight (1-100) |
| `onSubmitComment` | `(parentAuthor, parentPermlink, body) => void \| Promise<void>` | Called when a comment is submitted |
| `onClickCommentUpvote` | `(author, permlink, percent) => void \| Promise<void>` | Called when a comment is upvoted inside the comments modal |
| `onReblog` | `() => void` | Called when reblog is clicked |
| `onShare` | `() => void` | Called when share is clicked. Falls back to Web Share API / clipboard |
| `onTip` | `() => void` | Called when tip is clicked |
| `onReport` | `() => void` | Called when report is clicked |
| `onVotePoll` | `(author: string, permlink: string, choiceNums: number[]) => void \| Promise<void>` | Called when user votes on a poll. `choiceNums` is an array of 1-based choice numbers |

**Poll Voting Behaviour**

When a post has `json_metadata.content_type === "poll"` the component renders a built-in poll widget:

| Scenario | Behaviour |
|----------|-----------|
| Single-choice poll (`max_choices_voted === 1`) | Clicking a choice immediately calls `onVotePoll` |
| Multi-choice poll (`max_choices_voted > 1`) | Checkboxes shown; selection capped at `max_choices_voted`; **Submit Vote** button appears once ≥ 1 option is selected |
| Poll ended | Choices shown read-only with vote percentages; voting UI hidden |
| Already voted (current session or via API) | Voted choices highlighted in green; "✓ Voted" shown in footer; voting UI hidden |
| `onVotePoll` not provided | Poll results rendered read-only regardless of poll status |

**Comment Composer Tokens**

| Prop | Type | Description |
|------|------|-------------|
| `ecencyToken` | `string` | Ecency image hosting token — enables image upload |
| `threeSpeakApiKey` | `string` | 3Speak API key — enables audio/video upload |
| `giphyApiKey` | `string` | GIPHY API key — enables GIF search |
| `templateToken` | `string` | HReplier API token — enables template picker |
| `templateApiBaseUrl` | `string` | Custom template API endpoint |

See [docs/HiveDetailPost.md](docs/HiveDetailPost.md) for full documentation including layout diagram, content rendering details, skeleton loading, and CSS requirements.

### Toolbar Component

- **HiveToolbar** - A fixed bottom toolbar showcasing Hive ecosystem apps and witness voting links. Responsive across mobile, tablet, and desktop.

#### HiveToolbar Usage

```tsx
import { HiveToolbar } from 'hive-react-kit';

// Show all items (default)
<HiveToolbar />

// Hide specific items
<HiveToolbar isDistriator={false} isHpolls={false} />

// Custom background color
<HiveToolbar backgroundColor="#1a1a2e" />
```

#### HiveToolbar Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isDistriator` | `boolean` | `true` | Show/hide Distriator link |
| `isCheckinwithxyz` | `boolean` | `true` | Show/hide CheckinWithXYZ link |
| `isHreplier` | `boolean` | `true` | Show/hide HReplier link |
| `isHpolls` | `boolean` | `true` | Show/hide HPolls link |
| `isHstats` | `boolean` | `true` | Show/hide HStats link |
| `isHsnaps` | `boolean` | `true` | Show/hide HSnaps link |
| `isHiveFestFacts` | `boolean` | `true` | Show/hide HiveFestFacts link |
| `backgroundColor` | `string` | `'#ffffff'` | Toolbar background color |
| `textColor` | `string` | `'#4b5563'` | Text color for all app names |
| `borderTopColor` | `string` | `'#e2e8f0'` | Top border color of the toolbar |

> **Note:** Vote Witness Sagar, Vote Witness 3Speak, and 3Speak are always visible and cannot be hidden.

### Landing Component

- **HiveContributionsLanding** – Configurable full-page landing for Hive contributions: vision/mission, beliefs, app status lists, contributions grid, supporters & partners section, optional expenses breakdown, and contact footer.

#### HiveContributionsLanding Usage

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';

// Default dark theme
<HiveContributionsLanding />

// Custom theme with all features enabled
<HiveContributionsLanding
  backgroundColor="#020617"
  textColor="#e5e7eb"
  cardBackgroundColor="rgba(15,23,42,0.9)"
  isDividerShow={true}
  dividerColor="rgba(148,163,184,0.4)"
  isExpensesCTA={true}
  extraSupporters={[
    {
      title: "Inspired by @arcange",
      description: "Inspired by Arcange's Engage app",
      avatar: "https://images.ecency.com/webp/u/arcange/avatar/medium",
      link: "https://peakd.com/@arcange",
      buttonText: "View",
    },
  ]}
/>
```

#### HiveContributionsLanding Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `backgroundColor` | `string` | `"#020617"` | Page background color. Also applied to the Expenses view when toggled. |
| `textColor` | `string` | `"#e5e7eb"` | Main text color. |
| `cardBackgroundColor` | `string` | `"rgba(15,23,42,0.85)"` | Background for all cards. |
| `isDividerShow` | `boolean` | `true` | Show/hide horizontal dividers between sections. |
| `dividerColor` | `string` | `"rgba(148,163,184,0.4)"` | Divider line color. |
| `isExpensesCTA` | `boolean` | `false` | Shows an Expenses CTA card that opens a full transparent expense breakdown view. |
| `extraSupporters` | `SupporterItem[]` | `[]` | Additional supporter cards appended after the 4 built-in defaults. |

#### SupporterItem type

```ts
interface SupporterItem {
  title: string;       // Card heading
  description: string; // Short subtitle
  avatar: string;      // Image URL
  link: string;        // Button href
  buttonText: string;  // Button label (e.g. "View", "Visit")
}
```

See [docs/HiveContributionsLanding.md](docs/HiveContributionsLanding.md) for full documentation including all sections, Expenses view details, and styling guidance.

#### Toolbar Items

| Item | URL |
|------|-----|
| Vote Witness Sagar | https://vote.hive.uno/@sagarkothari88 |
| Vote Witness 3Speak | https://vote.hive.uno/@threespeak |
| Distriator | https://distriator.com/ |
| CheckinWithXYZ | https://checkinwith.xyz/ |
| HReplier | https://hreplier.sagarkothari88.one/ |
| HPolls | https://hpolls.sagarkothari88.one/ |
| HStats | https://hstats.sagarkothari88.one/ |
| HSnaps | https://hsnaps.sagarkothari88.one/ |
| 3Speak | https://3speak.tv/ |
| HiveFestFacts | https://hivefestfacts.sagarkothari88.one/ |

### Feed Components

- **PostFeedList** - Display a list of posts with sorting, filtering, and interaction capabilities

#### PostFeedList Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sort` | `PostSort` | `'trending'` | Sort order for posts. Options: `'trending'`, `'hot'`, `'created'` |
| `tag` | `string` | `''` | Filter posts by tag |
| `observer` | `string` | `'hive.blog'` | Observer account for filtering |
| `limit` | `number` | `20` | Number of posts to load per request |
| `onAuthorClick` | `(author: string, avatar: string) => void` | - | Callback when author is clicked |
| `onPostClick` | `(post: Post) => void` | - | Callback when post is clicked |
| `onCommunityClick` | `(communityTitle: string) => void` | - | Callback when community is clicked |
| `onPayoutClick` | `(payout: number) => void` | - | Callback when payout is clicked |
| `onUpvoteClick` | `(post: Post) => void` | - | Callback when upvote button is clicked |
| `onCommentClick` | `(post: Post) => void` | - | Callback when comment button is clicked |
| `onReblogClick` | `(post: Post) => void` | - | Callback when reblog button is clicked |

## Setup

Make sure to install the required peer dependencies:

```bash
npm install react react-dom @tanstack/react-query @hiveio/dhive zustand
```

## Styling

This package ships a pre-compiled CSS file. Import it once in your app entry point:

```tsx
import 'hive-react-kit/build.css';
```

**Tailwind users** — add the package to your `content` array instead so your Tailwind build includes the classes:

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/hive-react-kit/dist/**/*.js',
  ],
};
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.