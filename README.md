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

## Setup

Make sure to install the required peer dependencies:

```bash
npm install react react-dom @tanstack/react-query @hiveio/dhive zustand
```

## Styling

This package uses Tailwind CSS. Make sure to include Tailwind CSS in your project:

```bash
npm install tailwindcss
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.