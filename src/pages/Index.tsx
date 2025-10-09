import { useState } from "react";
import { ApiVideoFeedType, VideoFeedItem } from "@/types/video";
import { User } from "@/types/user";
import VideoFeed from "@/components/VideoFeed";
import VideoInfo from "@/components/VideoInfo";
import VideoDetail from "@/components/VideoDetail";
import Wallet from "@/components/Wallet";
import CommunitiesList from "@/components/community/CommunitiesList";
import CommunityDetail from "@/components/community/CommunityDetail";
import UserAccount from "@/components/user/UserAccount";
import UserProfilePage from "@/components/user/UserProfilePage";
import Modal from "@/components/modals/Modal";
import CommentsModal from "@/components/comments/CommentsModal";
import UpvoteListModal from "@/components/UpvoteListModal";
import { Play, Github, Package, Users, Zap, Code, Wallet as WalletIcon, Copy, MessageSquare, ThumbsUp } from "lucide-react";

const Index = () => {
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedItem | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("trending");
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [demoUsername, setDemoUsername] = useState("threespeak");
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("shaktimaaan");
  const [usernameQuery, setUsernameQuery] = useState("shaktimaaan");
  const [communityQuery, setCommunityQuery] = useState("hive-163772");
  const [tagQuery, setTagQuery] = useState("threespeak");
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showUpvoteModal, setShowUpvoteModal] = useState(false);

  const getQuickStartCode = () => {
    switch (activeTab) {
      case "trending":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.TRENDING}
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "new":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';    
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.NEW_VIDEOS}
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "first":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.FIRST_UPLOADS}
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "home":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.HOME}
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "user":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.USER}
                username="shaktimaaan"
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "community":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.COMMUNITY}
                communityId="hive-163772"
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "tag":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.TAG_FEED}
                tag="threespeak"
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "search":
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.SEARCH}
                tag="shaktimaaan"
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
      case "wallet":
        return `import { Wallet } from 'hive-reactkit';
          function App() {
            return (
              <Wallet username="threespeak" />
            );
          }`;
      case "communities":
        return `import { CommunitiesList } from 'hive-reactkit';
          function App() {
            return (
              <CommunitiesList
                onSelectCommunity={(communityId) => console.log(communityId)}
              />
            );
          }`;
      case "video-detail":
        return `import { VideoDetail } from 'hive-reactkit';
          function App() {
            return (
              <VideoDetail
                username="shaktimaaan"
                permlink="fyiytkhbkz"
                onAuthorClick={(author) => console.log("Author clicked:", author)}
                onVideoClick={(video) => console.log("Video clicked:", video)}
                onTagClick={(tag) => console.log("Tag clicked:", tag)}
                onBack={() => console.log("Back clicked")}
                onCommentsModal={(author, permlink) => console.log("Comments modal:", author, permlink)}
                onUpvotesModal={(author, permlink) => console.log("Upvotes modal:", author, permlink)}
                onDescriptionModal={(author, permlink, content) => console.log("Description modal:", author, permlink, content)}
                onVideoInfo={(video) => console.log("Video info:", video)}
                onShare={(author, permlink) => console.log("Share:", author, permlink)}
                onBookmark={(author, permlink) => console.log("Bookmark:", author, permlink)}
              />
            );
          }`;
      case "user-profile":
        return `import { UserProfilePage } from 'hive-reactkit';
          function App() {
            return (
              <UserProfilePage
                username="shaktimaaan"
                onVideoClick={(video) => console.log("Video clicked:", video)}
                onAuthorClick={(author) => console.log("Author clicked:", author)}
                onBack={() => console.log("Back clicked")}
                onClickUserInfoTab={() => console.log("User Info tab clicked")}
                onClickFollowersTab={() => console.log("Followers tab clicked")}
                onClickFollowingTab={() => console.log("Following tab clicked")}
                onBookmarkToggle={(username, isBookmarked) => console.log("Bookmark toggled:", username, isBookmarked)}
                onRss={(username) => console.log("RSS:", username)}
                onShare={(username) => console.log("Share:", username)}
                onMoreMenu={(username) => console.log("More menu:", username)}
                showMoreMenu={false}
              />
            );
          }`;
      case "community-detail":
        return `import { CommunityDetail } from 'hive-reactkit';
          function App() {
            return (
              <CommunityDetail
                communityId="hive-163772"
                onVideoClick={(video) => console.log("Video clicked:", video)}
                onAuthorClick={(author) => console.log("Author clicked:", author)}
                onBack={() => console.log("Back clicked")}
                onclickAboutTab={() => console.log("About tab clicked")}
                onclickTeamTab={() => console.log("Team tab clicked")}
                onclickMemberTab={() => console.log("Member tab clicked")}
                onShare={() => console.log("Share clicked")}
                onFavourite={() => console.log("Favourite clicked")}
                onRss={() => console.log("RSS clicked")}
                onMoreVertical={() => console.log("MoreVertical clicked")}
                showMoreVertical={false}
              />
            );
          }`;
      case "account":
        return `import { UserAccount } from 'hive-reactkit';
          function App() {
            const user = { username: "shaktimaaan", token: "demo_token" };

            return (
              <UserAccount
                currentUser={user}
                onPublish={(username, permlink) => console.log("Publish:", username, permlink)}
                onViewMyVideo={(username, permlink) => console.log("View my video:", username, permlink)}
                onTapBackButton={() => console.log("Back button tapped")}
                shouldShowBackButton={false}
                shouldShowPublishButton={false}
                shouldShowMoreOptionsButton={false}
              />
            );
          }`;
        return `import { UserAccount } from 'hive-reactkit';
          function App() {
            const user = { username: "shaktimaaan", token: "demo_token" };

            return (
              <UserAccount
                currentUser={user}
                onPublish={(username, permlink) => console.log("Publish:", username, permlink)}
                onViewMyVideo={(username, permlink) => console.log("View my video:", username, permlink)}
                onTapBackButton={() => console.log("Back button tapped")}
                shouldShowBackButton={false}
                shouldShowPublishButton={false}
                shouldShowMoreOptionsButton={false}
              />
            );
          }`;
      case "comments":
        return `import { CommentsModal } from 'hive-reactkit';
          function App() {
            const [showComments, setShowComments] = useState(false);
            const user = { username: "shaktimaaan", token: "demo_token" };

            return (
              <>
                <button onClick={() => setShowComments(true)}>
                  Open Comments
                </button>
                <CommentsModal
                  isOpen={showComments}
                  onClose={() => setShowComments(false)}
                  author="shaktimaaan"
                  permlink="fyiytkhbkz"
                  currentUser={user.username}
                  token={user.token}
                  onClickCommentUpvote={(comment) => console.log("Upvote comment:", comment)}
                  onClickCommentReply={(comment) => console.log("Reply to comment:", comment)}
                  onClickUpvoteButton={(currentUser, token) => console.log("Custom upvote:", currentUser, token)}
                />
              </>
            );
          }`;
      case "upvotes":
        return `import { UpvoteListModal } from 'hive-reactkit';
          function App() {
            const [showUpvotes, setShowUpvotes] = useState(false);
            const user = { username: "shaktimaaan", token: "demo_token" };

            return (
              <>
                <button onClick={() => setShowUpvotes(true)}>
                  Open Upvotes
                </button>
                <UpvoteListModal
                  author="shaktimaaan"
                  permlink="fyiytkhbkz"
                  onClose={() => setShowUpvotes(false)}
                  currentUser={user.username}
                  token={user.token}
                  onClickUpvoteButton={(currentUser, token) => {
                    // Custom upvote logic here
                    console.log("Custom upvote:", currentUser, token);
                  }}
                />
              </>
            );
          }`;
      default:
        return `import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
          function App() {
            return (
              <VideoFeed
                feedType={ApiVideoFeedType.TRENDING}
                onVideoClick={(video) => console.log(video)}
                onAuthorClick={(author) => console.log(author)}
              />
            );
          }`;
    }
  };

  // Mock user for demonstration - in a real app, this would come from authentication
  const mockUser: User | null = {
    username: "shaktimaaan",
    token: "demo_token_123"
  };

  const handleVideoClick = (video: VideoFeedItem) => {
    console.log("Video clicked:", video);
  };

  const handleAuthorClick = (author: string) => {
    console.log("Author clicked:", author);
  };

  const handleCommunitySelect = (communityId: string) => {
    console.log("Selected community:", communityId);
    setSelectedCommunityId(communityId);
  };

  const feedTabs = [
    { id: "trending", label: "Trending", icon: "🔥", type: ApiVideoFeedType.TRENDING },
    { id: "new", label: "New", icon: "✨", type: ApiVideoFeedType.NEW_VIDEOS },
    { id: "first", label: "First Uploads", icon: "🎬", type: ApiVideoFeedType.FIRST_UPLOADS },
    { id: "home", label: "Home", icon: "🏠", type: ApiVideoFeedType.HOME },
    { id: "user", label: "User Feed", icon: "👤", type: ApiVideoFeedType.USER },
    { id: "community", label: "Community Feed", icon: "👥", type: ApiVideoFeedType.COMMUNITY },
    { id: "tag", label: "Tag Feed", icon: "🏷️", type: ApiVideoFeedType.TAG_FEED },
    { id: "search", label: "Search", icon: "🔍", type: ApiVideoFeedType.SEARCH },
    { id: "video-detail", label: "Video Detail", icon: "🎥" },
    { id: "user-profile", label: "User Profile", icon: "👤" },
    { id: "wallet", label: "Wallet Demo", icon: "💰" },
    { id: "communities", label: "Communities", icon: "👥" },
    { id: "account", label: "My Account", icon: "👤" },
    { id: "community-detail", label: "Community Detail", icon: "👥" },
    { id: "comments", label: "Comments Modal", icon: "💬" },
    { id: "upvotes", label: "Upvotes Modal", icon: "👍" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {selectedCommunityId ? (
        <CommunityDetail
          communityId={selectedCommunityId}
          onBack={() => setSelectedCommunityId(null)}
          onVideoClick={handleVideoClick}
          onAuthorClick={handleAuthorClick}
        // onclickAboutTab={() => console.log("About tab clicked")}
        // onclickTeamTab={() => console.log("Team tab clicked")}
        // onclickMemberTab={() => console.log("Member tab clicked")}
        // onShare={() => console.log("Share clicked")}
        // onFavourite={() => console.log("Favourite clicked")}
        // onRss={() => console.log("RSS clicked")}
        // onMoreVertical={() => console.log("MoreVertical clicked")}
        // showMoreVertical={false}
        />
      ) : (
        <>
          {/* Hero Section */}
          <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-blue-600 text-white">
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
              <div className="text-center">
                <h1 className="text-5xl font-bold mb-6">
                  HiveReactkit
                </h1>
                <p className="text-xl mb-8 text-white/90 max-w-3xl mx-auto">
                  Professional React components for Hive blockchain video content.
                  Beautiful, responsive, and ready to integrate into your projects.
                </p>
                <div className="flex justify-center gap-4">
                  <button className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors">
                    <Package className="w-5 h-5" />
                    Install Package
                  </button>
                  <button className="inline-flex items-center gap-2 border border-white/30 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors">
                    <Github className="w-5 h-5" />
                    View on GitHub
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-16 bg-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Powerful Components
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Everything you need to build amazing video applications with Hive blockchain integration
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Play className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Video Components</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Ready-to-use video cards, feeds, and players with beautiful animations
                  </p>
                </div>

                <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Social Features</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Comments, upvotes, sharing, and user interactions built-in
                  </p>
                </div>

                <div className="text-center p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Hive Blockchain</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Full integration with 3Speak and Hive blockchain APIs
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Code Example Section */}
          <section className="py-16 bg-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Easy to Use
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Get started with just a few lines of code
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Quick Start - {feedTabs.find(t => t.id === activeTab)?.label}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(getQuickStartCode())}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Copy code"
                  >
                    <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
                <pre className="text-sm text-gray-600 dark:text-gray-400 overflow-x-auto min-h-[120px] bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  {getQuickStartCode()}
                </pre>
              </div>
            </div>
          </section>

          {/* Live Demo Section */}
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Live Demo
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Explore real Hive blockchain video content with our components
                </p>
              </div>

              {/* Feed Tabs */}
              <div className="flex justify-center mb-8">
                <div className="flex flex-wrap justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                  {feedTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallet Demo Controls */}
              {activeTab === "wallet" && (
                <div className="mb-8 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Try the Wallet Component</h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input
                      type="text"
                      value={demoUsername}
                      onChange={(e) => setDemoUsername(e.target.value)}
                      placeholder="Enter Hive username..."
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={() => setDemoUsername(demoUsername || "threespeak")}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg transition-all duration-300"
                    >
                      Load Wallet
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Try usernames like: threespeak, gtg, blocktrades, acidyo
                  </p>
                </div>
              )}

              {/* Content */}
              <div className="max-h-[656px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-8">
                {activeTab === "wallet" ? (
                  <div className="max-w-2xl mx-auto">
                    <Wallet username={demoUsername} />
                  </div>
                ) : activeTab === "communities" ? (
                  <CommunitiesList onSelectCommunity={handleCommunitySelect} />
                ) : activeTab === "video-detail" ? (
                  <VideoDetail
                    username="shaktimaaan"
                    permlink="fyiytkhbkz"
                    onAuthorClick={(author) => console.log("Author clicked:", author)}
                    onVideoClick={(video) => console.log("Video clicked:", video)}
                    onTagClick={(tag) => console.log("Tag clicked:", tag)}
                    onBack={() => console.log("Back clicked")}
                    onCommentsModal={(author, permlink) => console.log("Comments modal:", author, permlink)}
                    onUpvotesModal={(author, permlink) => console.log("Upvotes modal:", author, permlink)}
                    onDescriptionModal={(author, permlink, content) => console.log("Description modal:", author, permlink, content)}
                    onVideoInfo={(video) => console.log("Video info:", video)}
                    onShare={(author, permlink) => console.log("Share:", author, permlink)}
                    onBookmark={(author, permlink) => console.log("Bookmark:", author, permlink)}
                  />
                ) : activeTab === "user-profile" ? (
                  <UserProfilePage
                    username="shaktimaaan"
                    onVideoClick={(video) => console.log("Video clicked:", video)}
                    onAuthorClick={(author) => console.log("Author clicked:", author)}
                    onBack={() => console.log("Back clicked")}
                    // onClickUserInfoTab={() => console.log("User Info tab clicked")}
                    // onClickFollowersTab={() => console.log("Followers tab clicked")}
                    // onClickFollowingTab={() => console.log("Following tab clicked")}
                    onBookmarkToggle={(username, isBookmarked) => console.log("Bookmark toggled:", username, isBookmarked)}
                    onRss={(username) => console.log("RSS:", username)}
                    onShare={(username) => console.log("Share:", username)}
                    onMoreMenu={(username) => console.log("More menu:", username)}
                    showMoreMenu={false}
                  />
                ) : activeTab === "community-detail" ? (
                  <CommunityDetail
                    communityId="hive-163772"
                    onVideoClick={(video) => console.log("Video clicked:", video)}
                    onAuthorClick={(author) => console.log("Author clicked:", author)}
                    onBack={() => console.log("Back clicked")}
                    onclickAboutTab={() => console.log("About tab clicked")}
                    onclickTeamTab={() => console.log("Team tab clicked")}
                    onclickMemberTab={() => console.log("Member tab clicked")}
                    onShare={() => console.log("Share clicked")}
                    onFavourite={() => console.log("Favourite clicked")}
                    onRss={() => console.log("RSS clicked")}
                    onMoreVertical={() => console.log("MoreVertical clicked")}
                    showMoreVertical={false}
                  />
                ) : activeTab === "account" ? (
                  <UserAccount
                    currentUser={mockUser}
                    onPublish={(username, permlink) => {
                      console.log("Publish:", username, permlink);
                    }}
                    onViewMyVideo={(username, permlink) => {
                      console.log("View my video:", username, permlink);
                    }}
                    onTapBackButton={() => console.log("Back button tapped")}
                    shouldShowBackButton={false}
                    shouldShowPublishButton={false}
                    shouldShowMoreOptionsButton={false}
                  />
                ) : activeTab === "comments" ? (
                  <div className="max-w-2xl mx-auto text-center">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                        Comments Modal Demo
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Click the button below to open the comments modal for a sample video.
                      </p>
                      <button
                        onClick={() => setShowCommentsModal(true)}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                      >
                        <MessageSquare className="w-5 h-5" />
                        Open Comments Modal
                      </button>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Features:</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• View and interact with comments</li>
                        <li>• Reply to comments</li>
                        <li>• Upvote comments (with optional token)</li>
                        <li>• Custom callback support</li>
                        <li>• Search through comments</li>
                      </ul>
                    </div>
                  </div>
                ) : activeTab === "upvotes" ? (
                  <div className="max-w-2xl mx-auto text-center">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                        Upvotes Modal Demo
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Click the button below to open the upvotes modal for a sample video.
                      </p>
                      <button
                        onClick={() => setShowUpvoteModal(true)}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                      >
                        <ThumbsUp className="w-5 h-5" />
                        Open Upvotes Modal
                      </button>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Features:</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>• View all upvotes for a post</li>
                        <li>• See voting percentages and timestamps</li>
                        <li>• Cast your own vote (with token)</li>
                        <li>• Real-time vote updates</li>
                      </ul>
                    </div>
                  </div>
                ) : feedTabs.find(t => t.id === activeTab)?.type ? (
                  <>
                    {activeTab === "search" && (
                      <div className="mb-4">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search videos..."
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}
                    {activeTab === "user" && (
                      <div className="mb-4">
                        <input
                          type="text"
                          value={usernameQuery}
                          onChange={(e) => setUsernameQuery(e.target.value)}
                          placeholder="Enter username..."
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}
                    {activeTab === "community" && (
                      <div className="mb-4">
                        <input
                          type="text"
                          value={communityQuery}
                          onChange={(e) => setCommunityQuery(e.target.value)}
                          placeholder="Enter community ID..."
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}
                    {activeTab === "tag" && (
                      <div className="mb-4">
                        <input
                          type="text"
                          value={tagQuery}
                          onChange={(e) => setTagQuery(e.target.value)}
                          placeholder="Enter tag..."
                          className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}
                    <VideoFeed
                      feedType={feedTabs.find(t => t.id === activeTab)?.type}
                      onVideoClick={handleVideoClick}
                      onAuthorClick={handleAuthorClick}
                      {...(activeTab === "search" ? { tag: searchQuery } : activeTab === "user" ? { username: usernameQuery } : activeTab === "community" ? { communityId: communityQuery } : activeTab === "tag" ? { tag: tagQuery } : {})}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </section>

          {/* Video Player Modal */}
          {showVideoPlayer && selectedVideo && (
            <Modal
              isOpen={showVideoPlayer}
              onClose={() => setShowVideoPlayer(false)}
              title={selectedVideo.title}
              maxWidth="max-w-4xl"
            >
              <div className="aspect-video bg-black">
                <div className="flex items-center justify-center h-full text-white">
                  <div className="text-center">
                    <Play className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg">Video Player Placeholder</p>
                    <p className="text-sm text-white/70 mt-2">
                      Real video player would be integrated here
                    </p>
                  </div>
                </div>
              </div>
              <VideoInfo
                title={selectedVideo.title}
                author={selectedVideo.author}
                permlink={selectedVideo.permlink}
                createdAt={selectedVideo.created}
                video={selectedVideo}
                description="This is a demo description for the video."
              />
            </Modal>
          )}

          {/* Comments Modal */}
          {showCommentsModal && (
            <CommentsModal
              author="shaktimaaan"
              permlink="fyiytkhbkz"
              onClose={() => setShowCommentsModal(false)}
              currentUser={mockUser?.username}
              token={mockUser?.token}
            />
          )}

          {/* Upvotes Modal */}
          {showUpvoteModal && (
            <UpvoteListModal
              author="shaktimaaan"
              permlink="fyiytkhbkz"
              onClose={() => setShowUpvoteModal(false)}
              currentUser={mockUser?.username}
              token={mockUser?.token}
              onClickUpvoteButton={(currentUser, token) => {
                console.log("Custom upvote button clicked:", currentUser, token);
                // Custom logic can be added here
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Index;
