import { useParams, useNavigate } from 'react-router-dom';
import UserProfilePage from '@/components/user/UserProfilePage';
import { VideoFeedItem } from '@/types/video';

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const handleVideoClick = (video: VideoFeedItem) => {
    navigate(`/video/${video.author}/${video.permlink}`);
  };

  const handleAuthorClick = (author: string) => {
    navigate(`/user/${author}`);
  };

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  if (!username) {
    return <div>User not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="container mx-auto px-4 py-8">
            <UserProfilePage
                username={username}
                onVideoClick={handleVideoClick}
                onAuthorClick={handleAuthorClick}
                onBack={handleBack}
            />
        </div>
    </div>
  );
};

export default UserProfile;
