import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiVideoFeedType, VideoFeedItem } from "@/types/video";
import { User } from "@/types/user";
import VideoFeed from "@/components/VideoFeed";
import VideoInfo from "@/components/VideoInfo";
import Wallet from "@/components/Wallet";
import CommunitiesList from "@/components/community/CommunitiesList";
import CommunityDetail from "@/components/community/CommunityDetail";
import UserAccount from "@/components/user/UserAccount";
import TransactionHistory from "@/components/TransactionHistory";
import ActivityHistory from "@/components/ActivityHistory";
import Modal from "@/components/modals/Modal";
import { Play, Github, Package, Users, Zap, Code, Wallet as WalletIcon, Activity, FileText } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedItem | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("trending");
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [demoUsername, setDemoUsername] = useState("threespeak");
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  
  // Mock user for demonstration - in a real app, this would come from authentication
  const mockUser: User | null = {
    username: "demo_user",
    token: "demo_token_123"
  };

  const handleVideoClick = (video: VideoFeedItem) => {
    // Navigate to video detail page instead of showing modal
    window.location.href = `/video/${video.author}/${video.permlink}`;
  };

  const handleAuthorClick = (author: string) => {
    setSelectedAuthor(author);
    // In a real implementation, this would navigate to the author's profile
    console.log("Navigate to author:", author);
  };

  const handleCommunitySelect = (communityId: string) => {
    console.log("Selected community:", communityId);
    setSelectedCommunityId(communityId);
  };

  const feedTabs = [
    { id: "trending", label: "Trending", icon: "🔥", type: ApiVideoFeedType.TRENDING },
    { id: "new", label: "New", icon: "✨", type: ApiVideoFeedType.NEW_VIDEOS },
    { id: "first", label: "First Uploads", icon: "🎬", type: ApiVideoFeedType.FIRST_UPLOADS },
    { id: "wallet", label: "Wallet Demo", icon: "💰" },
    { id: "transactions", label: "Transactions", icon: "💸" },
    { id: "activity", label: "Activity", icon: "📝" },
    { id: "communities", label: "Communities", icon: "👥" },
    { id: "account", label: "My Account", icon: "👤" },
  ];

  return (
    <div className="min-h-screen bg-background">
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
          <section className="relative overflow-hidden bg-gradient-hero text-white">
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
      <section className="py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-card-foreground mb-4">
              Powerful Components
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build amazing video applications with Hive blockchain integration
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6 rounded-xl bg-background border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Video Components</h3>
              <p className="text-muted-foreground text-sm">
                Ready-to-use video cards, feeds, and players with beautiful animations
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-background border border-border">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Social Features</h3>
              <p className="text-muted-foreground text-sm">
                Comments, upvotes, sharing, and user interactions built-in
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-background border border-border">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Transaction History</h3>
              <p className="text-muted-foreground text-sm">
                Complete transaction history with filtering and search capabilities
              </p>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-background border border-border">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Activity History</h3>
              <p className="text-muted-foreground text-sm">
                User posts, comments, and replies with detailed analytics
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-card-foreground mb-4">
              Live Demo
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Explore real Hive blockchain video content with our components
            </p>
          </div>

          {/* Feed Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-card border border-border rounded-lg p-1">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-card-foreground hover:bg-muted"
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
            <div className="mb-8 p-6 bg-card border border-border rounded-xl max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-4 text-card-foreground">Try the Wallet Component</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={demoUsername}
                  onChange={(e) => setDemoUsername(e.target.value)}
                  placeholder="Enter Hive username..."
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => setDemoUsername(demoUsername || "threespeak")}
                  className="px-6 py-2 bg-gradient-primary text-primary-foreground rounded-lg hover:shadow-glow transition-all duration-300"
                >
                  Load Wallet
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Try usernames like: threespeak, gtg, blocktrades, acidyo
              </p>
            </div>
          )}

          {/* Transaction History Demo Controls */}
          {(activeTab === "transactions" || activeTab === "activity") && (
            <div className="mb-8 p-6 bg-card border border-border rounded-xl max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-4 text-card-foreground">
                {activeTab === "transactions" ? "Transaction History Demo" : "Activity History Demo"}
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={demoUsername}
                  onChange={(e) => setDemoUsername(e.target.value)}
                  placeholder="Enter Hive username..."
                  className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={() => setDemoUsername(demoUsername || "threespeak")}
                  className="px-6 py-2 bg-gradient-primary text-primary-foreground rounded-lg hover:shadow-glow transition-all duration-300"
                >
                  Load History
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Try usernames like: threespeak, gtg, blocktrades, acidyo
              </p>
            </div>
          )}

          {/* Content */}
          {activeTab === "wallet" ? (
            <div className="max-w-2xl mx-auto">
              <Wallet username={demoUsername} />
            </div>
          ) : activeTab === "transactions" ? (
            <div className="max-w-4xl mx-auto">
              <TransactionHistory account={demoUsername} />
            </div>
          ) : activeTab === "activity" ? (
            <div className="max-w-4xl mx-auto">
              <ActivityHistory username={demoUsername} />
            </div>
          ) : activeTab === "communities" ? (
            <CommunitiesList onSelectCommunity={handleCommunitySelect} />
          ) : activeTab === "account" ? (
            <UserAccount
              currentUser={mockUser}
              onPublish={(username, permlink) => {
                navigate(`/video/${username}/${permlink}`);
              }}
              onViewMyVideo={(username, permlink) => {
                navigate(`/video/${username}/${permlink}`);
              }}
              onTapBackButton={() => navigate(-1)}
              shouldShowBackButton={false}
              shouldShowPublishButton={false}
              shouldShowMoreOptionsButton={false}  
            />
          ) : (
            <VideoFeed
              feedType={feedTabs.find(t => t.id === activeTab)?.type || ApiVideoFeedType.TRENDING}
              onVideoClick={handleVideoClick}
              onAuthorClick={handleAuthorClick}
            />
          )}
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-card-foreground mb-4">
              Easy to Use
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started with just a few lines of code
            </p>
          </div>
          
          <div className="bg-background border border-border rounded-xl p-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-primary" />
              <span className="font-medium text-card-foreground">Quick Start</span>
            </div>
            <pre className="text-sm text-muted-foreground overflow-x-auto">
              {`import { VideoFeed, ApiVideoFeedType } from 'hive-reactkit';
                  function App() {
                    return (
                      <VideoFeed
                        feedType={ApiVideoFeedType.TRENDING}
                        onVideoClick={(video) => console.log(video)}
                        onAuthorClick={(author) => console.log(author)}
                      />
                    );
                  }`
              }
            </pre>
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
        </>
      )}
    </div>
  );
};

export default Index;
