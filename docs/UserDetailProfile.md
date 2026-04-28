# UserDetailProfile

A comprehensive, dark-mode user profile component with 15 configurable tabs, callback-based architecture, infinite scroll pagination, and skeleton loading.

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
  ecencyToken="your-ecency-token"
  threeSpeakApiKey="your-3speak-api-key"
  giphyApiKey="your-giphy-api-key"
  templateToken="your-jwt-token"
  templateApiBaseUrl="https://your-api.com/data/templates"
  onBack={() => navigate(-1)}
  onFollow={(user) => broadcastFollow(user)}
  onPostClick={(author, permlink, title) => navigate(`/post/${author}/${permlink}`)}
  onUserClick={(user) => navigate(`/profile/${user}`)}
  // Favourite functionality
  onFavouriteList={() => navigate('/favourites')}
  favouriteCount={5}
  onAddToFavourite={(user) => addToFavourites(user)}
  isFavourited={false}
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
| `tabShown` | `TabType[]` | No | all 15 tabs | Controls which tabs are visible and their display order. First tab is the default active tab. If omitted, all tabs are shown in default order |

### Composer Tokens

These tokens enable rich media features in the comment composer toolbar. When a token is not provided, the corresponding toolbar button is automatically hidden.

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ecencyToken` | `string` | No | `undefined` | Ecency image hosting token. Enables **image upload**, **video thumbnail upload**, and **paste/drag-drop image upload**. Without it, the image upload button is hidden |
| `threeSpeakApiKey` | `string` | No | `undefined` | 3Speak API key. Enables **audio recording/upload** and **video upload** (TUS protocol). Without it, audio and video buttons are hidden |
| `giphyApiKey` | `string` | No | `undefined` | GIPHY API key. Enables **GIF search**. Without it, the GIF button is hidden |
| `templateToken` | `string` | No | `undefined` | HReplier API JWT token. Enables **template picker** (insert saved reply templates). Without it, the template button is hidden |
| `templateApiBaseUrl` | `string` | No | `https://hreplier-api.sagarkothari88.one/data/templates` | Custom template API endpoint. Override when self-hosting the template service |

> **Note:** Bold, Italic, Link, Code, @Mention, and Emoji toolbar buttons are always available — they don't require any external token.

These tokens are threaded through the full component chain: `UserDetailProfile` → `PostActionButton` → `CommentsModal` / `ReplyModal` → `PostComposer (AddCommentInput)`.

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
| `onPollClick` | `(author: string, permlink: string, question: string) => void` | Poll card body clicked. Clicks on poll choices, the submit button, and the action bar are intercepted and do **not** trigger this |
| `onVotePoll` | `(author, permlink, choiceNums: number[]) => void \| boolean \| Promise<void \| boolean>` | User submitted an inline vote from the polls tab. See [Inline Poll Voting](#inline-poll-voting) below |
| `onActivityPermlink` | `(author: string, permlink: string) => void` | Activity permlink clicked |
| `onActivitySelect` | `(activity: any) => void` | Activity item selected |
| `onShare` | `(username: string) => void` | Share button clicked in the header |
| `onFavouriteList` | `() => void \| Promise<void>` | Favourite list icon clicked in the header (shows count badge if `favouriteCount > 0`) |
| `onAddToFavourite` | `(username: string) => void \| Promise<void>` | Add to favourite icon clicked in profile details overlay |
| `isFavourited` | `boolean` | Controls heart icon fill state in profile details (red when `true`) |
| `favouriteCount` | `number` | Count displayed as badge on favourite list icon in header |

## Favourite Functionality

The component includes two favourite-related features that appear automatically when their respective callbacks are provided:

### Favourite List Icon (Header)
- **Location**: Top-right navbar actions area
- **Visibility**: Shows only when `onFavouriteList` callback is provided
- **Features**: 
  - Heart icon with red badge showing `favouriteCount`
  - Badge shows "99+" for counts over 99
  - Click triggers `onFavouriteList` callback

### Add to Favourite Icon (Profile Details)
- **Location**: Profile details overlay on cover image (right side)
- **Visibility**: Shows only when `onAddToFavourite` callback is provided
- **Features**:
  - Heart icon that changes appearance based on `isFavourited` state
  - White outline when not favourited (`isFavourited = false`)
  - Red filled when favourited (`isFavourited = true`)
  - Click triggers `onAddToFavourite` with the username

```tsx
<UserDetailProfile
  username="sagarkothari88"
  // Favourite list in header with count badge
  onFavouriteList={() => navigate('/favourites')}
  favouriteCount={5}
  
  // Add to favourite in profile details
  onAddToFavourite={(user) => addToFavourites(user)}
  isFavourited={true} // Shows red filled heart
  
  // ... other props
/>
```

## Inline Poll Voting

The polls tab renders each poll as a rich card with **all choices visible
inline**, vote percentages as horizontal fill bars, and (when `currentUsername`
+ `onVotePoll` are provided) a built-in voting flow — users never have to leave
the list to vote.

The voting widget is the same one used inside [HiveDetailPost](HiveDetailPost.md);
the underlying component is exported as `PollListItem` if you want to reuse it
outside of `UserDetailProfile`.

### Behaviour

Every interactive flow goes through the **same `onVotePoll(author, permlink, choiceNums)` callback** — the consumer never has to branch on poll type. The user always confirms via an explicit **Submit Vote** button (no auto-submit on tap).

| Scenario | Behaviour |
|----------|-----------|
| Active poll, single-choice (`max_choices_voted === 1`) | Choices behave as **radio buttons** — selecting another option replaces the previous selection. **Submit Vote** button calls `onVotePoll(author, permlink, [choiceNum])` |
| Active poll, multi-choice (`max_choices_voted > 1`) | Choices behave as **checkboxes** — tapping toggles, capped at `max_choices_voted`. **Submit Vote** button calls `onVotePoll(author, permlink, [n1, n2, …])` |
| Already voted (current session or via `poll_voters` from API) | Voted choices highlighted in green, "✓ Voted" footer marker; voting UI hidden unless `allow_vote_changes` is set |
| `allow_vote_changes` and already voted | Old vote rendered dimmed-green so the user remembers their previous choice; user re-selects and clicks **Change Vote**, which calls the same `onVotePoll` callback |
| Poll ended (`status === "Ended"` or `end_time` passed) | Choices read-only with vote percentages; voting UI hidden |
| `onVotePoll` not provided OR `currentUsername` empty | All choices read-only with vote bars; no Submit button |

### Cancellation

`onVotePoll` may return `false` (or a Promise resolving to `false`) — for
example when a Hive Keychain prompt is denied. In that case the per-card vote
state is **not** updated, so the user can re-attempt without seeing a stale
"voted" marker.

### Click-event isolation

Clicks inside choice rows, the submit button, the vote-cancel flow, and the
`PostActionButton` row do **not** bubble up to the card, so `onPollClick` only
fires when the user clicks the question/preview area.

### Example

```tsx
<UserDetailProfile
  username="user"
  currentUsername="myaccount"
  tabShown={["polls", "blogs"]}
  onVotePoll={async (author, permlink, choices) => {
    // Hive Keychain or any signing flow
    const ok = await signAndBroadcastPollVote(author, permlink, choices);
    if (!ok) return false;       // cancelled — UI keeps the user's selection
    // success — UserDetailProfile marks the choices as voted
  }}
  onPollClick={(author, permlink) => navigate(`/@${author}/${permlink}`)}
/>
```

### Standalone usage

```tsx
import { PollListItem, type PollListItemProps } from 'hive-react-kit';

<PollListItem
  poll={pollObject}
  currentUsername="myaccount"
  onVotePoll={(author, permlink, choices) => votePoll(author, permlink, choices)}
  onPollClick={(author, permlink) => navigate(`/@${author}/${permlink}`)}
  onUpvote={(author, permlink, percent) => upvote(author, permlink, percent)}
  onRequestReportPost={(author, permlink) => openReportModal(author, permlink)}
  // …other forwarded action callbacks
/>
```

## Content translation (i18n)

When this component renders inside a `<HiveLanguageProvider>` with a non-English `language`, every user-generated string on the feed cards is translated automatically — no extra props needed:

- **Post / blog / snap / comment / reply card titles** (the bold heading on each card).
- **Body previews** (the truncated snippet under the title).
- **Poll questions, body previews, and every choice label** on the Polls tab.
- **All comment bodies** rendered by `CommentTile` / `InlineCommentItem` (Activities tab, threaded replies, comments modal).

Wrap your app once and every kit-rendered body follows the chosen language:

```tsx
import { HiveLanguageProvider } from 'hive-react-kit'

<HiveLanguageProvider language={i18n.language}>
  <UserDetailProfile username="alice" />
</HiveLanguageProvider>
```

Defaults to `"en"` (no-op). See [i18n.md](i18n.md) for the full provider API, hook usage, custom-translator integration, and caching behaviour.

## TabType Reference

| Value | Label | Data Source | Pagination |
|-------|-------|-------------|------------|
| `"blogs"` | Blogs | `bridge.get_account_posts` (sort: blog) | Cursor-based, infinite scroll |
| `"posts"` | Posts | `bridge.get_account_posts` (sort: posts) | Cursor-based, infinite scroll |
| `"snaps"` | Snaps | PeakD API + `bridge.get_post` batch | startId cursor, infinite scroll |
| `"polls"` | Polls | HiveHub polls API | All at once |
| `"growth"` | Growth | `condenser_api.get_account_history` (rewards / power-up / power-down ops) | Streamed (7d/30d toggle) |
| `"comments"` | Comments | `bridge.get_account_posts` (sort: comments) | Cursor-based, infinite scroll |
| `"replies"` | Replies | `bridge.get_account_posts` (sort: replies) | Cursor-based, infinite scroll |
| `"activities"` | Activities | ActivityList component (internal) | Internal |
| `"authorRewards"` | Author Rewards | `bridge.get_account_posts` + price feed | Streamed progressively |
| `"curationRewards"` | Curation Rewards | Vote history + `get_content` estimation | Streamed in batches of 6 |
| `"followers"` | Followers | `condenser_api.get_followers` | Cursor-based, infinite scroll |
| `"following"` | Following | `condenser_api.get_following` | Cursor-based, infinite scroll |
| `"wallet"` | Wallet | Wallet component (internal) | N/A |
| `"votingPower"` | Voting Power | `getAccounts` + `rc_api.find_rc_accounts` + `get_reward_fund` + `get_feed_history` | N/A |
| `"badges"` | Badges | `condenser_api.get_followers` (filtered by `badge-` prefix) | N/A |
| `"witnessVotes"` | Witness Votes | `getAccounts` → `witness_votes` field | N/A |

## tabShown Examples

```tsx
// Default: all 15 tabs in default order
<UserDetailProfile username="user" />

// Only 3 tabs — Wallet opens first
<UserDetailProfile
  username="user"
  tabShown={["wallet", "blogs", "followers"]}
/>

// Stats-focused: voting power, wallet, badges, witnesses (no login required)
<UserDetailProfile
  username="user"
  tabShown={[
    "votingPower", "wallet", "activities",
    "followers", "following", "badges", "witnessVotes",
    "authorRewards", "curationRewards"
  ]}
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
    "followers", "following", "wallet",
    "votingPower", "badges", "witnessVotes"
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
          "followers", "following", "wallet",
          "votingPower", "badges", "witnessVotes"
        ]}
        // Composer tokens — omit any to hide that toolbar button
        ecencyToken="your-ecency-token"
        threeSpeakApiKey="your-3speak-api-key"
        giphyApiKey="your-giphy-api-key"
        templateToken="your-jwt-token"
        templateApiBaseUrl="https://your-api.com/data/templates"
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
        // Favourite functionality
        onFavouriteList={() => navigate('/favourites')}
        favouriteCount={5}
        onAddToFavourite={(user) => addToFavourites(user)}
        isFavourited={false}
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
- **Rich comment composer (PostComposer)** with markdown toolbar (Bold, Italic, Link, Code, @Mention), image upload (Ecency), audio record/upload (3Speak), video upload with TUS protocol (3Speak), GIF search (GIPHY), comprehensive emoji picker (500+ emojis, 9 categories), template picker (HReplier API), paste/drag-drop image upload, and live preview via `@snapie/renderer` (3Speak video/audio embeds, IPFS, Twitter, Instagram)
- **Token-gated toolbar** — upload buttons auto-hide when the corresponding API token is not provided
- **PostComposer** also available as standalone component — see [PostComposer docs](./PostComposer.md)
- **Vote value slider** with real-time HIVE/HBD calculation, 5% step increments, and low mana warning
- **Voting Power tab** with progress bars for upvote power, downvote power, and resource credits
- **Badges tab** showing followers with `badge-` prefix in responsive grid (1/3/4 columns)
- **Witness Votes tab** showing voted witnesses in the same responsive grid layout
- **Wallet with transaction history** showing sent/received transfers with direction icons, avatars, and color-coded amounts
- **Dark mode only** with consistent gray-800/900 color palette
- **Responsive** — compact layout on mobile, expanded on desktop (follower/following/badges/witness grids: 1 col mobile, 3 col tablet, 4 col desktop)

## TypeScript

```tsx
import type { UserDetailProfileProps } from 'hive-react-kit';

// TabType is not exported directly, but you can use it via the tabShown prop type:
type TabType = NonNullable<UserDetailProfileProps['tabShown']>[number];
// "blogs" | "posts" | "snaps" | "polls" | "comments" | "replies" |
// "activities" | "authorRewards" | "curationRewards" | "followers" |
// "following" | "wallet" | "votingPower" | "badges" | "witnessVotes"
```

## Voting Power Tab Details

The Voting Power tab displays:

### Vote Value Slider
- Range input from 0% to 100% with **5% step** increments
- Real-time calculation of vote value in both **HBD** and **HIVE**
- Shows "low mana" warning when voting power is insufficient for the selected weight
- Formula (based on [hivelytics](https://github.com/mrtats/hivelytics)):
  - `rshares = maxMana * 0.02 * (weight / 10000)`
  - `hiveValue = (rshares / recentClaims) * rewardBalance`
  - `hbdValue = hiveValue * feedPrice`

### Progress Bars
| Bar | Color | Source |
|-----|-------|--------|
| Voting Power | Green (#10b981) | Regenerated from `voting_manabar` over 5-day cycle |
| Downvote Power | Amber (#f59e0b) | Regenerated from `downvote_manabar` (1/4 of max mana) |
| Resource Credits | Blue (#3b82f6) | Fetched via `rc_api.find_rc_accounts` |
