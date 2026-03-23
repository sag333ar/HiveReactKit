import { PostComposer } from '../components/comments/AddCommentInput';

const PostComposerPage = () => {
  const ecencyToken = import.meta.env.VITE_ECENCY_TOKEN || undefined;
  const threeSpeakApiKey = import.meta.env.VITE_THREE_SPEAK_API_KEY || undefined;
  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY || undefined;
  const templateToken = import.meta.env.VITE_TEMPLATE_TOKEN || undefined;
  const templateApiBaseUrl = import.meta.env.VITE_TEMPLATE_API_BASE_URL || undefined;

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">PostComposer</h1>
        <p className="text-gray-400 text-sm">
          Rich markdown composer with preview, image/audio/video upload, paste &amp; drag-drop, GIF, emoji, @ mention, templates, and code blocks.
        </p>

        <PostComposer
          onSubmit={(body) => {
            console.log("PostComposer submitted:", body);
            alert(`Submitted:\n\n${body}`);
          }}
          onCancel={() => {
            console.log("PostComposer cancelled");
            alert("Cancelled");
          }}
          currentUser="sagarkothari88"
          parentAuthor="shaktimaaan"
          placeholder="Write something in Markdown..."
          title="Create a Post"
          submitLabel="Publish"
          showCancel={true}
          defaultPreviewOn={false}
          ecencyToken={ecencyToken}
          threeSpeakApiKey={threeSpeakApiKey}
          giphyApiKey={giphyApiKey}
          templateToken={templateToken}
          templateApiBaseUrl={templateApiBaseUrl}
          onPollChange={(poll) => {
            console.log("Poll changed:", poll);
            if (poll) alert(`Poll attached: ${poll.question} (${poll.choices.length} choices)`);
            else alert("Poll removed");
          }}
        />
      </div>
    </div>
  );
};

export default PostComposerPage;
