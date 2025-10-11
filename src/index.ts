// Main components exports
export { default as VideoCard } from './components/VideoCard';
export { default as VideoDetail } from './components/VideoDetail';
export { default as VideoFeed } from './components/VideoFeed';
export { default as VideoInfo } from './components/VideoInfo';
export { default as Wallet } from './components/Wallet';
export { default as ListOfWitnesses } from './components/ListOfWitnesses';

// Common components
export { default as FavouriteWidget } from './components/common/FavouriteWidget';

// Community components
export { default as CommunitiesList } from './components/community/CommunitiesList';
export { default as CommunityAbout } from './components/community/CommunityAbout';
export { default as CommunityDetail } from './components/community/CommunityDetail';
export { default as CommunityMembers } from './components/community/CommunityMembers';
export { default as CommunityTeam } from './components/community/CommunityTeam';

// Modal components
export { default as CommentsModal } from './components/modals/CommentsModal';
export { default as DescriptionModal } from './components/modals/DescriptionModal';
export { default as Modal } from './components/modals/Modal';
export { default as UpvoteListModal } from './components/modals/UpvoteListModal';

// User components
export { default as UserAccount } from './components/user/UserAccount';
export { default as UserFollowers } from './components/user/UserFollowers';
export { default as UserFollowing } from './components/user/UserFollowing';
export { default as UserInfo } from './components/user/UserInfo';
export { default as UserProfilePage } from './components/user/UserProfilePage';

// UI components from shadcn/ui (if available)
// Note: UI components need to be added to the project first

// Hooks
export * from './hooks/use-mobile';
export * from './hooks/use-toast';

// Utils
// Note: Add utils when available

// Types
export * from './types/comment';
export * from './types/graphql';
export * from './types/trending';
export * from './types/video';
export * from './types/wallet';
export * from './types/witness';

// Services
export * from './services/apiService';
export * from './services/witnessService';

// Store
export * from './store/walletStore';
