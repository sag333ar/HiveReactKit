// Main components exports
export { default as VideoCard } from './components/VideoCard';
export { default as VideoDetail } from './components/VideoDetail';
export { default as VideoFeed } from './components/VideoFeed';
export { default as VideoInfo } from './components/VideoInfo';
export { default as Wallet } from './components/Wallet';
export { default as Delegations, type DelegationsProps } from './components/Delegations';
export { default as WorldMappinMap, type WorldMappinMapProps } from './components/WorldMappinMap';
export {
  extractWorldMappinPin,
  extractWorldMappinPins,
  stripWorldMappinMarkers,
  type WorldMappinPin,
} from './utils/worldMappin';
export { default as PostFeedList } from './components/PostFeedList';
export { default as BlogPostList, type BlogPostListProps } from './components/BlogPostList';
export {
  default as SnapsFeedView,
  type SnapsFeedViewProps,
  type SnapsFeedSlot,
  type SnapsFeedKey,
} from './components/feed/SnapsFeedView';
export {
  default as SnapsFeedCard,
  type SnapsFeedCardProps,
} from './components/feed/SnapsFeedCard';
export {
  default as SnapsFeedList,
  type SnapsFeedListProps,
} from './components/feed/SnapsFeedList';
export {
  default as FeedSegmentControl,
  type FeedSegmentControlProps,
  type FeedSegmentOption,
} from './components/feed/FeedSegmentControl';
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
export {
  PostActionButton,
  type PostActionButtonProps,
  MoreActionsMenu,
  type MoreActionsMenuProps,
} from './components/actionButtons';
export { PostComposer, default as AddCommentInput } from './components/comments/AddCommentInput';
export type { PostComposerProps, AddCommentInputProps } from './components/comments/AddCommentInput';

// Composer components (Image, Audio, Video uploaders, GIF picker, Meme picker, Emoji picker, Template picker, Post Templates panel)
export { ImageUploader, AudioUploader, VideoUploader, GiphyPicker, YoutubePicker, MemePicker, DecentMemesPicker, EmojiPicker, TemplatePicker, PostTemplatesPanel, PollCreator, BeneficiariesEditor, ParentPostComposer, ToolbarHelpModal } from './components/composer';
export type { ImageUploaderProps, AudioUploaderProps, VideoUploaderProps, VideoUploadDetails, GiphyPickerProps, YoutubePickerProps, MemePickerProps, DecentMemesPickerProps, EmojiPickerProps, TemplatePickerProps, PostTemplatesPanelProps, PostTemplate, PostTemplatePayload, PollCreatorProps, PollData, BeneficiariesEditorProps, ParentPostComposerProps, ParentPostSubmitPayload, ToolbarHelpModalProps, ToolbarHelpEntry } from './components/composer';

// Common components
export { default as FavouriteWidget } from './components/common/FavouriteWidget';

// Community components
export { default as CommunitiesList } from './components/community/CommunitiesList';
export { default as CommunityAbout } from './components/community/CommunityAbout';
export {
  default as CommunityDetail,
  type CommunityDetailProps,
} from './components/community/CommunityDetail';
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
export { default as UserGrowth } from './components/user/UserGrowth';
export type { UserGrowthProps } from './components/user/UserGrowth';
export { default as PollListItem } from './components/user/PollListItem';
export type { PollListItemProps } from './components/user/PollListItem';
export { default as KERatioBadge } from './components/user/KERatioBadge';
export { calculateKERatio, type KERatioResult } from './services/userService';

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
  isPostTooOldToVote,
  parseHiveCreated,
  VOTE_WINDOW_DAYS,
  VOTE_WINDOW_MS,
  VOTE_WINDOW_MESSAGE,
} from './utils/voteAge';

// Re-exports from @snapie/renderer — Hive markdown renderer used internally
// by HiveDetailPost / AddCommentInput / InlineCommentItem. Surfaced so
// consumers can render Hive bodies with the exact same configuration without
// installing @snapie/renderer themselves.
export { createHiveRenderer, renderHiveMarkdown, type HiveRendererOptions } from '@snapie/renderer';

// i18n — wrap your app in <HiveLanguageProvider language={...}> to translate
// every Hive content body rendered by the kit (post bodies, comments,
// activity feeds, snaps) into the chosen language.
export {
  HiveLanguageProvider,
  useHiveLanguage,
  useKitT,
  useTranslatedHtml,
  useTranslatedText,
  translateHtml,
  translateText,
  BUILTIN_MESSAGES,
  formatMessage,
  type HiveLanguageProviderProps,
  type HiveLanguageContextValue,
  type TranslateHtmlFn,
  type KitTFn,
  type KitMessageKey,
  type KitMessages,
} from './i18n';
export { default as TranslatedBody, type TranslatedBodyProps } from './components/TranslatedBody';
export { default as TranslatedText, type TranslatedTextProps } from './components/TranslatedText';
export { default as SelectionTranslator } from './components/SelectionTranslator';
export { LanguagePickerButton } from './components/LanguagePickerButton';
export {
  translateSelection,
  DEFAULT_TRANSLATE_LANGUAGES,
  getPreferredTranslateLanguage,
  setPreferredTranslateLanguage,
  type SelectionTranslateLanguage,
} from './i18n/selectionTranslate';
export {
  buildCommentOptions,
  REWARD_OPTIONS,
  REWARD_OPTION_LABELS,
  type RewardOption,
} from './utils/commentOptions';
export {
  THREESPEAK_FUND_ACCOUNT,
  THREESPEAK_FUND_PERCENT,
  bodyHasVideo,
  normalizeBeneficiaryAccount,
  sanitizeBeneficiaries,
  totalBeneficiaryWeight,
  enforceVideoBeneficiaries,
  enforceLockedBeneficiaries,
  buildBeneficiariesCommentOptions,
  mergeBeneficiariesIntoCommentOptions,
  type Beneficiary,
} from './utils/beneficiaries';
export {
  DECENTMEMES_WIDGET_URL,
  DECENTMEMES_WIDGET_ORIGIN,
  DECENTMEMES_TAG,
  DECENTMEMES_SCHEMA_VERSION,
  DECENTMEMES_MAX_PER_POST,
  DECENTMEMES_MAX_PER_COMMENT,
  aggregateDecentMemesBeneficiaries,
  decentMemesAsBeneficiaries,
  buildDecentMemesMetadata,
  getDecentMemesLimit,
  isDecentMemesCreatedEvent,
  pickDecentMemesKind,
  type DecentMemesBeneficiary,
  type DecentMemesTemplate,
  type DecentMemesMeme,
  type DecentMemesCreatedEvent,
} from './utils/decentmemes';

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
export * from './types/proposal';
// export * from './types/witness';

// Runtime-configurable Hive RPC endpoint. Call `setHiveApiEndpoint(url)`
// once at app startup (and again whenever the user changes the node in
// settings) to route every dhive client and direct JSON-RPC fetch inside
// the kit through that node.
export {
  getHiveApiEndpoint,
  setHiveApiEndpoint,
  subscribeHiveApiEndpoint,
  getHiveClient,
  // Lock the kit's endpoint against future setHiveApiEndpoint
  // calls. Consumers turn this on to enforce a single-node policy
  // when vendor packages or network interceptors try to rotate.
  lockHiveApiEndpoint,
  isHiveApiEndpointLocked,
} from './config/hiveEndpoint';

// Services
export * from './services/apiService';
export * from './services/userService';
export * from './services/witnessService';
export * from './services/proposalService';
export * from './services/templateService';
export { uploadToHiveImages, type PostingSignMessageFn } from './services/hiveImageUpload';

// Store
export * from './store/walletStore';
