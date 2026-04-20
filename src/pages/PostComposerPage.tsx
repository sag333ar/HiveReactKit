import { PostComposer } from '../components/comments/AddCommentInput';
import { buildCommentOptions, type RewardOption } from '../utils/commentOptions';
import { useRef } from 'react';

const PostComposerPage = () => {
  const ecencyToken = import.meta.env.VITE_ECENCY_TOKEN || undefined;
  const threeSpeakApiKey = import.meta.env.VITE_THREE_SPEAK_API_KEY || undefined;
  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY || undefined;
  const templateToken = import.meta.env.VITE_TEMPLATE_TOKEN || undefined;
  const templateApiBaseUrl = import.meta.env.VITE_TEMPLATE_API_BASE_URL || undefined;

  // Keep the latest tag list and reward option so we can log a full op preview on submit.
  const tagsRef = useRef<string[]>([]);
  const rewardRef = useRef<RewardOption>('default');

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">PostComposer</h1>
        <p className="text-gray-400 text-sm">
          Rich markdown composer with preview, image/audio/video upload, paste &amp; drag-drop, GIF, emoji, @ mention, templates, code blocks, tag manager (locked defaults + up to 10 total), and reward routing (50/50, 100% power, burn, decline).
        </p>

        <PostComposer
          onSubmit={(body) => {
            const author = 'shaktimaaan';
            const permlink = 're-peaksnaps-demo';
            const commentOp = [
              'comment',
              {
                parent_author: 'peak.snaps',
                parent_permlink: 'snap-container-demo',
                author,
                permlink,
                title: '',
                body,
                json_metadata: JSON.stringify({
                  app: 'peakd/2026.4.3',
                  tags: tagsRef.current,
                  image: [],
                }),
              },
            ];
            const opts = buildCommentOptions(author, permlink, rewardRef.current);
            const ops = opts ? [commentOp, opts] : [commentOp];
            console.log('PostComposer submitted:', body);
            console.log('Ops to broadcast:', JSON.stringify(ops, null, 2));
            alert(`Submitted with reward "${rewardRef.current}" and tags [${tagsRef.current.join(', ')}]\n\nCheck the console for the full op array.`);
          }}
          onCancel={() => {
            console.log('PostComposer cancelled');
            alert('Cancelled');
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
          defaultTags={['snaps', 'hsnaps']}
          onTagsChange={(tags) => {
            tagsRef.current = tags;
            console.log('Tags changed:', tags);
          }}
          defaultReward="default"
          onRewardChange={(opt) => {
            rewardRef.current = opt;
            console.log('Reward changed:', opt);
          }}
          onPollChange={(poll) => {
            console.log('Poll changed:', poll);
            if (poll) alert(`Poll attached: ${poll.question} (${poll.choices.length} choices)`);
            else alert('Poll removed');
          }}
        />
      </div>
    </div>
  );
};

export default PostComposerPage;
