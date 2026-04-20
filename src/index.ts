// Main components exports
export { default as VideoCard } from './components/VideoCard';
export { default as VideoDetail } from './components/VideoDetail';
export { default as VideoFeed } from './components/VideoFeed';
export { default as VideoInfo } from './components/VideoInfo';
export { default as Wallet } from './components/Wallet';
export { default as PostFeedList } from './components/PostFeedList';
export { default as ProposalsList } from './components/ProposalsList';
export { default as FollowersList } from './components/FollowersList';
export { default as FollowingList } from './components/FollowingList';
export { default as ActivityList } from './components/ActivityList';
export { default as ListOfWitnesses } from './components/ListOfWitnesses';
export { default as TransactionHistory } from './components/TransactionHistory';
export { default as UserChannel } from './components/UserChannel';
export { default as HiveToolbar, type HiveToolbarProps } from './components/HiveToolbar';
export { HiveDetailPost, type HiveDetailPostProps } from './components/HiveDetailPost';
export { default as CommentsModal } from './components/comments/CommentsModal';
export { PostActionButton, type PostActionButtonProps } from './components/actionButtons';
export { PostComposer, default as AddCommentInput } from './components/comments/AddCommentInput';
export type { PostComposerProps, AddCommentInputProps } from './components/comments/AddCommentInput';

// Composer components (Image, Audio, Video uploaders, GIF picker, Emoji picker, Template picker)
export { ImageUploader, AudioUploader, VideoUploader, GiphyPicker, EmojiPicker, TemplatePicker, PollCreator } from './components/composer';
export type { ImageUploaderProps, AudioUploaderProps, VideoUploaderProps, GiphyPickerProps, EmojiPickerProps, TemplatePickerProps, PollCreatorProps, PollData } from './components/composer';

// Common components
export { default as FavouriteWidget } from './components/common/FavouriteWidget';

// Community components
export { default as CommunitiesList } from './components/community/CommunitiesList';
export { default as CommunityAbout } from './components/community/CommunityAbout';
export { default as CommunityDetail } from './components/community/CommunityDetail';
export { default as CommunityPostDetails } from './components/community/CommunityPostDetails';
export { default as CommunityMembers } from './components/community/CommunityMembers';
export { default as CommunityTeam } from './components/community/CommunityTeam';

// List components
export { UpvoteList } from './components/UpvoteList';
export { CommentsList } from './components/CommentsList';
export { default as UpvoteListModal } from './components/UpvoteListModal';

// Modal components
export { default as Modal } from './components/modals/Modal';

// User components
export { default as UserAccount } from './components/user/UserAccount';
export { default as UserFollowers } from './components/user/UserFollowers';
export { default as UserFollowing } from './components/user/UserFollowing';
export { default as UserInfo } from './components/user/UserInfo';
export { default as UserProfilePage } from './components/user/UserProfilePage';
export { default as UserDetailProfile } from './components/user/UserDetailProfile';
export type { UserDetailProfileProps } from './components/user/UserDetailProfile';

// Landing components
export { default as HiveContributionsLanding } from './components/landing-page/HiveContributionsLanding';
export { default as ExpensesView } from './components/landing-page/ExpensesView';

// UI components from shadcn/ui (if available)
// Note: UI components need to be added to the project first

// Hooks
export * from './hooks/use-mobile';
export * from './hooks/use-toast';
export * from './hooks/useHiveImageSign';

// Utils
export { parseHiveFrontendUrl, type HiveLinkTarget } from './utils/hiveLinks';
export {
  buildCommentOptions,
  REWARD_OPTIONS,
  REWARD_OPTION_LABELS,
  type RewardOption,
} from './utils/commentOptions';

// Types
export * from './types/comment';
export * from './types/graphql';
export * from './types/trending';
export * from './types/user';
export * from './types/post';
export * from './types/video';
export * from './types/poll';
export * from './types/reward';
export * from './types/wallet';
// export * from './types/witness';

// Services
export * from './services/apiService';
export * from './services/userService';
export * from './services/witnessService';
export * from './services/templateService';
export { uploadToHiveImages, type PostingSignMessageFn } from './services/hiveImageUpload';

// Store
export * from './store/walletStore';
