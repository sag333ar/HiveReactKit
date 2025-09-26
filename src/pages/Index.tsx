import { useState } from "react";
import { ApiVideoFeedType, VideoFeedItem } from "@/types/video";
import VideoFeed from "@/components/VideoFeed";
import VideoInfo from "@/components/VideoInfo";
import Modal from "@/components/modals/Modal";
import { Play, Github, Package, Users, Zap, Code } from "lucide-react";

const Index = () => {
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedItem | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ApiVideoFeedType>(ApiVideoFeedType.TRENDING);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  const handleVideoClick = (video: VideoFeedItem) => {
    setSelectedVideo(video);
    setShowVideoPlayer(true);
  };

  const handleAuthorClick = (author: string) => {
    setSelectedAuthor(author);
    // In a real implementation, this would navigate to the author's profile
    console.log("Navigate to author:", author);
  };

  const feedTabs = [
    { id: ApiVideoFeedType.TRENDING, label: "Trending", icon: "🔥" },
    { id: ApiVideoFeedType.NEW_VIDEOS, label: "New", icon: "✨" },
    { id: ApiVideoFeedType.FIRST_UPLOADS, label: "First Uploads", icon: "🎬" },
  ];

  return (
    <div className="min-h-screen bg-background">
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
          
          <div className="grid md:grid-cols-3 gap-8">
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
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Hive Blockchain</h3>
              <p className="text-muted-foreground text-sm">
                Full integration with 3Speak and Hive blockchain APIs
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

          {/* Video Feed */}
          <VideoFeed
            feedType={activeTab}
            onVideoClick={handleVideoClick}
            onAuthorClick={handleAuthorClick}
          />
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
}`}
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
    </div>
  );
};

export default Index;
