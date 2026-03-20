import { useParams, useNavigate } from "react-router-dom";
import UserDetailProfile from "@/components/user/UserDetailProfile";

const UserDetailProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  if (!username) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-gray-400">User not found</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-10">
      <UserDetailProfile
        username={username}
        currentUsername="sagarkothari88"
        showBackButton
        onBack={() => navigate(-1)}
        onFollow={(user) => {
          console.log("[Callback] Follow:", user);
          alert(`Follow @${user} — integrate with Aioha/HiveKeychain here`);
        }}
        onUnfollow={(user) => {
          console.log("[Callback] Unfollow:", user);
          alert(`Unfollow @${user} — integrate with Aioha/HiveKeychain here`);
        }}
        onIgnoreAuthor={(user) => {
          console.log("[Callback] Ignore:", user);
          alert(`Ignored @${user}`);
        }}
        onReportUser={(user, reason) => {
          console.log("[Callback] Report:", user, reason);
          alert(`Reported @${user} for: ${reason}`);
        }}
        onUpvotePost={(author, permlink) => {
          console.log("[Callback] Upvote Post:", author, permlink);
          alert(`Upvote post @${author}/${permlink}`);
        }}
        onUpvoteComment={(author, permlink) => {
          console.log("[Callback] Upvote Comment:", author, permlink);
          alert(`Upvote comment @${author}/${permlink}`);
        }}
        onReplyComment={(author, permlink) => {
          console.log("[Callback] Reply Comment:", author, permlink);
          alert(`Reply to @${author}/${permlink}`);
        }}
        onUserClick={(user) => {
          console.log("[Callback] User Click:", user);
          navigate(`/profile/${user}`);
        }}
        onPostClick={(author, permlink, title) => {
          console.log("[Callback] Post Click:", author, permlink, title);
          navigate(`/video/${author}/${permlink}`);
        }}
        onShare={(user) => {
          console.log("[Callback] Share:", user);
          const url = `https://peakd.com/@${user}`;
          navigator.clipboard.writeText(url);
          alert(`Profile link copied: ${url}`);
        }}
      />
    </div>
  );
};

export default UserDetailProfilePage;
