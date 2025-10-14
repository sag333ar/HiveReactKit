# FollowersList Component

A comprehensive React component for displaying a detailed list of followers for a given Hive account. Features a responsive design with table view for desktop and card view for mobile.

## Features

- **Responsive Design**: Desktop table view and mobile card view
- **HP Calculation**: Real-time HP calculation using vesting shares
- **Vote Values**: USD vote value calculations for each follower
- **Date Formatting**: Smart relative/absolute date formatting for last posts
- **Dropdown Menus**: Click-outside-to-close functionality with manage actions
- **User Profiles**: Avatar, location, and bio display with hover tooltips
- **Interactive Elements**: Clickable usernames and management actions

## Installation

```bash
npm install hive-react-kit
```

## Usage

### Basic Usage

```tsx
import { FollowersList } from 'hive-react-kit';

function App() {
  return (
    <FollowersList
      username="shaktimaaan"
      onClickAuthor={(username) => console.log("Author clicked:", username)}
      onClickAddRemoveFromLists={(username) => console.log("Add/remove from lists:", username)}
      onClickFollow={(username) => console.log("Follow clicked:", username)}
    />
  );
}
```

### With Custom Styling

```tsx
import { FollowersList } from 'hive-react-kit';

function App() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <FollowersList
        username="shaktimaaan"
        onClickAuthor={(username) => {
          // Navigate to user profile
          window.location.href = `/user/${username}`;
        }}
        onClickAddRemoveFromLists={(username) => {
          // Handle add/remove from lists
          console.log("Add/remove from lists:", username);
        }}
        onClickFollow={(username) => {
          // Handle follow action
          console.log("Follow:", username);
        }}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `username` | `string` | - | Username to fetch followers for |
| `onClickAuthor` | `(username: string) => void` | - | Callback when author is clicked |
| `onClickAddRemoveFromLists` | `(username: string) => void` | - | Callback when add/remove from lists is clicked |
| `onClickFollow` | `(username: string) => void` | - | Callback when follow button is clicked |

## Data Displayed

### Desktop Table View
- **Avatar**: User profile image with fallback
- **Username**: Clickable username with location icon (if available)
- **Last Post**: Formatted date of last post (relative time or absolute date)
- **HP**: Calculated Hive Power from vesting shares
- **Vote Value**: Calculated USD vote value
- **Manage**: Dropdown menu with actions

### Mobile Card View
- **Avatar**: User profile image
- **Username**: Clickable username with location indicator
- **Last Post**: Formatted date at top right
- **HP**: Calculated Hive Power
- **Manage**: Dropdown menu with actions

## API Integration

The component uses the following Hive API endpoints:

- `condenser_api.get_followers` - Get list of followers
- `condenser_api.get_accounts` - Get detailed account information
- `condenser_api.get_dynamic_global_properties` - For HP calculations
- `condenser_api.get_feed_history` - For vote value calculations

## Error Handling

The component includes comprehensive error handling:

- **Loading States**: Shows loading spinner while fetching data
- **Error States**: Displays error messages with retry functionality
- **Empty States**: Shows appropriate message when no followers exist
- **Network Errors**: Graceful handling of API failures

## Styling

The component uses Tailwind CSS classes and supports dark mode. All interactive elements have proper hover states and transitions.

## Dependencies

- React 16.8+
- Tailwind CSS
- Lucide React (for icons)
- Hive API access

## Examples

### Integration with React Router

```tsx
import { FollowersList } from 'hive-react-kit';
import { useNavigate } from 'react-router-dom';

function FollowersPage({ username }: { username: string }) {
  const navigate = useNavigate();

  return (
    <FollowersList
      username={username}
      onClickAuthor={(username) => navigate(`/user/${username}`)}
      onClickAddRemoveFromLists={(username) => {
        // Handle list management
      }}
      onClickFollow={(username) => {
        // Handle follow
      }}
    />
  );
}
```

### With State Management

```tsx
import { FollowersList } from 'hive-react-kit';
import { useState } from 'react';

function FollowersManager() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  return (
    <FollowersList
      username="shaktimaaan"
      onClickAuthor={setSelectedUser}
      onClickAddRemoveFromLists={(username) => {
        // Add to custom list
      }}
      onClickFollow={(username) => {
        // Handle follow action
      }}
    />
  );
}
```

## Accessibility

- Keyboard navigation support
- Screen reader friendly
- Proper ARIA labels
- Focus management for dropdowns

## Performance

- Efficient API calls with proper caching
- Lazy loading of vote calculations
- Optimized re-renders
- Mobile-first responsive design
