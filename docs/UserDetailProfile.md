# UserDetailProfile

A comprehensive, dark-mode user profile component with 12 configurable tabs, callback-based architecture, infinite scroll pagination, and skeleton loading.

## Installation

```bash
npm install hive-react-kit
```

```tsx
import { UserDetailProfile } from 'hive-react-kit';
import 'hive-react-kit/build.css';
```

## Quick Start

```tsx
<UserDetailProfile
  username="sagarkothari88"
  currentUsername="myaccount"
  showBackButton
  onBack={() => navigate(-1)}
  onFollow={(user) => broadcastFollow(user)}
  onPostClick={(author, permlink, title) => navigate(`/post/${author}/${permlink}`)}
  onUserClick={(user) => navigate(`/profile/${user}`)}
/>
```

## Props

### Core Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `username` | `string` | Yes | - | Hive username to display |
| `currentUsername` | `string` | No | `undefined` | Logged-in user. Enables follow/unfollow menu and vote actions |
| `showBackButton` | `boolean` | No | `false` | Show back arrow in the sticky header |
| `onBack` | `() => void` | No | - | Called when back button is clicked |
| `tabShown` | `TabType[]` | No | all 12 tabs | Controls which tabs are visible and their display order. First tab is the default active tab. If omitted, all tabs are shown in default order |

### Social Action Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onFollow` | `(username: string) => void \| Promise<void>` | Follow button clicked in the action menu |
| `onUnfollow` | `(username: string) => void \| Promise<void>` | Unfollow button clicked in the action menu |
| `onIgnoreAuthor` | `(username: string) => void \| Promise<void>` | Ignore Author confirmed via modal |
| `onReportUser` | `(username: string, reason: string) => void \| Promise<void>` | Report submitted with one of 9 reason options |

### Post Action Callbacks

These fire from the `PostActionButton` component rendered on each post/comment/snap/poll card.

| Prop | Type | Description |
|------|------|-------------|
| `onUpvote` | `(author: string, permlink: string, percent: number) => void \| Promise<void>` | Vote submitted via the vote slider (percent: 1-100) |
| `onSubmitComment` | `(parentAuthor: string, parentPermlink: string, body: string) => void \| Promise<void>` | Comment submitted from the comments modal |
| `onClickCommentUpvote` | `(author: string, permlink: string, percent: number) => void \| Promise<void>` | A comment inside the comments modal is upvoted |
| `onReblog` | `(author: string, permlink: string) => void` | Reblog button clicked |
| `onTip` | `(author: string, permlink: string) => void` | Tip button clicked |
| `onReportPost` | `(author: string, permlink: string) => void` | Report button clicked on a post |

### Navigation Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onUserClick` | `(username: string) => void` | User avatar/name clicked (in followers, following, post cards) |
| `onPostClick` | `(author: string, permlink: string, title: string) => void` | Blog, post, or reward row clicked |
| `onSnapClick` | `(author: string, permlink: string) => void` | Snap item clicked |
| `onPollClick` | `(author: string, permlink: string, question: string) => void` | Poll item clicked |
| `onActivityPermlink` | `(author: string, permlink: string) => void` | Activity permlink clicked |
| `onActivitySelect` | `(activity: any) => void` | Activity item selected |
| `onShare` | `(username: string) => void` | Share button clicked in the header |

## TabType Reference

| Value | Label | Data Source | Pagination |
|-------|-------|-------------|------------|
| `"blogs"` | Blogs | `bridge.get_account_posts` (sort: blog) | Cursor-based, infinite scroll |
| `"posts"` | Posts | `bridge.get_account_posts` (sort: posts) | Cursor-based, infinite scroll |
| `"snaps"` | Snaps | PeakD API + `bridge.get_post` batch | startId cursor, infinite scroll |
| `"polls"` | Polls | HiveHub polls API | All at once |
| `"comments"` | Comments | `bridge.get_account_posts` (sort: comments) | Cursor-based, infinite scroll |
| `"replies"` | Replies | `bridge.get_account_posts` (sort: replies) | Cursor-based, infinite scroll |
| `"activities"` | Activities | ActivityList component (internal) | Internal |
| `"authorRewards"` | Author Rewards | `bridge.get_account_posts` + price feed | Streamed progressively |
| `"curationRewards"` | Curation Rewards | Vote history + `get_content` estimation | Streamed in batches of 6 |
| `"followers"` | Followers | `condenser_api.get_followers` | Cursor-based, infinite scroll |
| `"following"` | Following | `condenser_api.get_following` | Cursor-based, infinite scroll |
| `"wallet"` | Wallet | Wallet component (internal) | N/A |

## tabShown Examples

```tsx
// Default: all 12 tabs in default order
<UserDetailProfile username="user" />

// Only 3 tabs — Wallet opens first
<UserDetailProfile
  username="user"
  tabShown={["wallet", "blogs", "followers"]}
/>

// Social-focused: followers and following first
<UserDetailProfile
  username="user"
  tabShown={["followers", "following", "blogs", "posts", "comments"]}
/>

// Content-only: no social or rewards tabs
<UserDetailProfile
  username="user"
  tabShown={["blogs", "posts", "snaps", "comments", "replies"]}
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

## Full Example

```tsx
import { UserDetailProfile } from 'hive-react-kit';
import { useNavigate, useParams } from 'react-router-dom';

const ProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  if (!username) return <p>User not found</p>;

  return (
    <div className="fixed inset-0 bg-gray-900">
      <UserDetailProfile
        username={username}
        currentUsername="myaccount"
        showBackButton
        tabShown={[
          "blogs", "posts", "snaps", "polls",
          "comments", "replies", "activities",
          "authorRewards", "curationRewards",
          "followers", "following", "wallet"
        ]}
        onBack={() => navigate(-1)}
        onFollow={(user) => {
          // Broadcast follow via HiveKeychain/Aioha
          console.log("Follow:", user);
        }}
        onUnfollow={(user) => {
          console.log("Unfollow:", user);
        }}
        onIgnoreAuthor={(user) => {
          console.log("Ignore:", user);
        }}
        onReportUser={(user, reason) => {
          console.log("Report:", user, reason);
        }}
        onUpvote={(author, permlink, percent) => {
          // Broadcast vote via HiveKeychain/Aioha
          console.log("Upvote:", author, permlink, percent);
        }}
        onSubmitComment={(parentAuthor, parentPermlink, body) => {
          console.log("Comment:", parentAuthor, parentPermlink, body);
        }}
        onReblog={(author, permlink) => {
          console.log("Reblog:", author, permlink);
        }}
        onTip={(author, permlink) => {
          console.log("Tip:", author, permlink);
        }}
        onPostClick={(author, permlink, title) => {
          navigate(`/post/${author}/${permlink}`);
        }}
        onSnapClick={(author, permlink) => {
          navigate(`/snap/${author}/${permlink}`);
        }}
        onPollClick={(author, permlink, question) => {
          navigate(`/poll/${author}/${permlink}`);
        }}
        onUserClick={(user) => {
          navigate(`/profile/${user}`);
        }}
        onShare={(user) => {
          navigator.clipboard.writeText(`https://peakd.com/@${user}`);
        }}
      />
    </div>
  );
};
```

## Features

- **Sticky header** with avatar, username, follower/following counts, share, and action menu
- **Cover image** with dark overlay showing profile details (name, about, location, website, join date, voting power, hive power)
- **Sticky tab bar** that pins below the header on scroll
- **Skeleton loading** for every tab (post cards, user grid, poll cards, reward rows)
- **Infinite scroll** with IntersectionObserver for all list tabs
- **Progressive streaming** for reward tabs — results appear as each batch completes
- **AbortController** cancels all in-flight API requests when switching tabs
- **150ms API throttle** between batch requests to prevent rate limiting
- **Image carousel** with fullscreen lightbox on post cards
- **Payout tooltip** with detailed breakdown (author rewards, beneficiaries, payout mode)
- **Dark mode only** with consistent gray-800/900 color palette
- **Responsive** — compact layout on mobile, expanded on desktop

## TypeScript

```tsx
import type { UserDetailProfileProps } from 'hive-react-kit';

// TabType is not exported directly, but you can use it via the tabShown prop type:
type TabType = NonNullable<UserDetailProfileProps['tabShown']>[number];
```
