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

### Community Components

- **CommunitiesList** - List of communities
- **CommunityDetail** - Community details
- **CommunityAbout** - Community about section
- **CommunityMembers** - Community members list
- **CommunityTeam** - Community team members

### Modal Components

- **CommentsModal** - Comments display modal
- **DescriptionModal** - Description editing modal
- **UpvoteListModal** - Upvote list modal
- **Modal** - Base modal component

### User Components

- **UserAccount** - User account management
- **UserProfilePage** - User profile page
- **UserInfo** - User information display
- **UserFollowers** - User followers list
- **UserFollowing** - User following list

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