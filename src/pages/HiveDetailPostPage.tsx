import { useParams, useNavigate } from "react-router-dom";
import { HiveDetailPost } from "@/components/HiveDetailPost";

const HiveDetailPostPage = () => {
  const params = useParams<{ author: string; permlink: string }>();
  const rawAuthor = params.author ?? "";
  const author = rawAuthor.startsWith("@") ? rawAuthor.slice(1) : rawAuthor;
  const permlink = params.permlink;
  const navigate = useNavigate();

  if (!author || !permlink) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-gray-400">Post not found</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-10">
      <HiveDetailPost
        author={author}
        permlink={permlink}
        currentUser="sagarkothari88"
        onBack={() => navigate(-1)}
        onNavigateToPost={(a, p) => navigate(`/@${a}/${p}`)}
        onUserClick={(user) => {
          console.log("[Callback] User Click:", user);
          navigate(`/@${user}`);
        }}
        onUpvote={(percent) => {
          console.log("[Callback] Upvote:", author, permlink, `${percent}%`);
          alert(`Upvote @${author}/${permlink} at ${percent}% — integrate with Aioha/HiveKeychain here`);
        }}
        onSubmitComment={(parentAuthor, parentPermlink, body) => {
          console.log("[Callback] Comment:", parentAuthor, parentPermlink, body);
          alert(`Comment on @${parentAuthor}/${parentPermlink}: "${body.substring(0, 50)}..."`);
        }}
        onClickCommentUpvote={(commentAuthor, commentPermlink, percent) => {
          console.log("[Callback] Comment Upvote:", commentAuthor, commentPermlink, `${percent}%`);
          alert(`Upvote comment @${commentAuthor}/${commentPermlink} at ${percent}%`);
        }}
        onReblog={() => {
          console.log("[Callback] Reblog:", author, permlink);
          alert(`Reblog @${author}/${permlink} — integrate with Aioha/HiveKeychain here`);
        }}
        onShare={() => {
          const url = `https://peakd.com/@${author}/${permlink}`;
          navigator.clipboard.writeText(url);
          console.log("[Callback] Share:", url);
          alert(`Post link copied: ${url}`);
        }}
        onTip={() => {
          console.log("[Callback] Tip:", author, permlink);
          alert(`Tip @${author} — integrate with transfer here`);
        }}
        onReport={() => {
          console.log("[Callback] Report:", author, permlink);
          alert(`Report @${author}/${permlink}`);
        }}
        onVotePoll={(pollAuthor, pollPermlink, choiceNums) => {
          console.log("[Callback] Poll Vote:", pollAuthor, pollPermlink, choiceNums);
          alert(`Vote on poll @${pollAuthor}/${pollPermlink} — choices: ${choiceNums.join(', ')}`);
        }}
        onShareComment={(cAuthor, cPermlink) => {
          const url = `https://peakd.com/@${cAuthor}/${cPermlink}`;
          navigator.clipboard.writeText(url);
          console.log("[Callback] Share Comment:", url);
          alert(`Comment link copied: ${url}`);
        }}
        onTipComment={(cAuthor, cPermlink) => {
          console.log("[Callback] Tip Comment:", cAuthor, cPermlink);
          alert(`Tip @${cAuthor} for comment ${cPermlink} — integrate with transfer here`);
        }}
        onReportComment={(cAuthor, cPermlink) => {
          console.log("[Callback] Report Comment:", cAuthor, cPermlink);
          alert(`Report comment @${cAuthor}/${cPermlink}`);
        }}
        reportedAuthors={[]}
        reportedPosts={[]}
        ecencyToken={import.meta.env.VITE_ECENCY_TOKEN || undefined}
        threeSpeakApiKey={import.meta.env.VITE_THREE_SPEAK_API_KEY || undefined}
        giphyApiKey={import.meta.env.VITE_GIPHY_API_KEY || undefined}
        templateToken={import.meta.env.VITE_TEMPLATE_TOKEN || undefined}
        templateApiBaseUrl={import.meta.env.VITE_TEMPLATE_API_BASE_URL || undefined}
      />
    </div>
  );
};

export default HiveDetailPostPage;
