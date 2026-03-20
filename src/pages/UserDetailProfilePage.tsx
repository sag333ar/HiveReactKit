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
        onUpvote={(author, permlink, percent) => {
          console.log("[Callback] Upvote:", author, permlink, `${percent}%`);
          alert(`Upvote @${author}/${permlink} at ${percent}% — integrate with Aioha/HiveKeychain here`);
        }}
        onSubmitComment={(parentAuthor, parentPermlink, body) => {
          console.log("[Callback] Comment:", parentAuthor, parentPermlink, body);
          alert(`Comment on @${parentAuthor}/${parentPermlink}: "${body.substring(0, 50)}..."`);
        }}
        onClickCommentUpvote={(author, permlink, percent) => {
          console.log("[Callback] Comment Upvote:", author, permlink, `${percent}%`);
          alert(`Upvote comment @${author}/${permlink} at ${percent}%`);
        }}
        onReblog={(author, permlink) => {
          console.log("[Callback] Reblog:", author, permlink);
          alert(`Reblog @${author}/${permlink}`);
        }}
        onTip={(author, permlink) => {
          console.log("[Callback] Tip:", author, permlink);
          alert(`Tip @${author}/${permlink}`);
        }}
        onReportPost={(author, permlink) => {
          console.log("[Callback] Report Post:", author, permlink);
          alert(`Report @${author}/${permlink}`);
        }}
        onUserClick={(user) => {
          console.log("[Callback] User Click:", user);
          navigate(`/profile/${user}`);
        }}
        onPostClick={(author, permlink, title) => {
          console.log("[Callback] Post Click:", author, permlink, title);
          navigate(`/video/${author}/${permlink}`);
        }}
        onSnapClick={(author, permlink) => {
          console.log("[Callback] Snap Click:", author, permlink);
          alert(`Open snap @${author}/${permlink}`);
        }}
        onPollClick={(author, permlink, question) => {
          console.log("[Callback] Poll Click:", author, permlink, question);
          alert(`Open poll: ${question}\n@${author}/${permlink}`);
        }}
        onActivityPermlink={(author, permlink) => {
          console.log("[Callback] Activity Permlink:", author, permlink);
          navigate(`/video/${author}/${permlink}`);
        }}
        onActivitySelect={(activity) => {
          console.log("[Callback] Activity Selected:", activity);
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
