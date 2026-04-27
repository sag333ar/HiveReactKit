import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import UserDetailProfile from "@/components/user/UserDetailProfile";

const UserDetailProfilePage = () => {
  const params = useParams<{ username: string }>();
  const rawUsername = params.username ?? "";
  const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const navigate = useNavigate();
  const [isFavourited, setIsFavourited] = useState(false);

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
        // tabShown={["followers", "following", "blogs", "posts", "comments", "replies", "polls", "activities", "authorRewards", "curationRewards", "wallet"]}
        ecencyToken={import.meta.env.VITE_ECENCY_TOKEN || undefined}
        threeSpeakApiKey={import.meta.env.VITE_THREE_SPEAK_API_KEY || undefined}
        giphyApiKey={import.meta.env.VITE_GIPHY_API_KEY || undefined}
        templateToken={import.meta.env.VITE_TEMPLATE_TOKEN || undefined}
        templateApiBaseUrl={import.meta.env.VITE_TEMPLATE_API_BASE_URL || undefined}
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
          // alert(`Reported @${user} for: ${reason}`);
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
          // alert(`Reblog @${author}/${permlink}`);
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
          navigate(`/@${user}`);
        }}
        onPostClick={(author, permlink, title) => {
          console.log("[Callback] Post Click:", author, permlink, title);
          navigate(`/@${author}/${permlink}`);
        }}
        onSnapClick={(author, permlink) => {
          console.log("[Callback] Snap Click:", author, permlink);
          navigate(`/@${author}/${permlink}`);
        }}
        onPollClick={(author, permlink, question) => {
          console.log("[Callback] Poll Click:", author, permlink, question);
          navigate(`/@${author}/${permlink}`);
        }}
        onVotePoll={(author, permlink, choiceNums) => {
          console.log("[Callback] Vote Poll:", author, permlink, choiceNums);
          const ok = window.confirm(
            `Vote on @${author}/${permlink}\nchoice${choiceNums.length > 1 ? "s" : ""}: ${choiceNums.join(", ")}\n\nIntegrate with Aioha/HiveKeychain here.\n\nClick OK to mark as voted, Cancel to simulate a denied signature.`
          );
          // Returning false here keeps the user's selection so they can retry
          // (mirrors the real Keychain-denied flow).
          return ok ? undefined : false;
        }}
        onActivityPermlink={(author, permlink) => {
          console.log("[Callback] Activity Permlink:", author, permlink);
          navigate(`/@${author}/${permlink}`);
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
        // onFavouriteList={() => {
        //   console.log("[Callback] Favourite List");
        //   alert("Open Favourite List");
        // }}
        // onAddToFavourite={(user) => {
        //   console.log("[Callback] Add to Favourite:", user);
        //   setIsFavourited(prev => !prev);
        // }}
        // isFavourited={isFavourited}
        // favouriteCount={5}
      />
    </div>
  );
};

export default UserDetailProfilePage;
