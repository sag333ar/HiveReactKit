import { PostComposer } from '../components/comments/AddCommentInput';
import { buildCommentOptions, type RewardOption } from '../utils/commentOptions';
import {
  aggregateDecentMemesBeneficiaries,
  buildDecentMemesMetadata,
  DECENTMEMES_TAG,
  type DecentMemesMeme,
} from '../utils/decentmemes';
import { useRef } from 'react';

const PostComposerPage = () => {
  const ecencyToken = import.meta.env.VITE_ECENCY_TOKEN || undefined;
  const threeSpeakApiKey = import.meta.env.VITE_THREE_SPEAK_API_KEY || undefined;
  const giphyApiKey = import.meta.env.VITE_GIPHY_API_KEY || undefined;
  const templateToken = import.meta.env.VITE_TEMPLATE_TOKEN || undefined;
  const templateApiBaseUrl = import.meta.env.VITE_TEMPLATE_API_BASE_URL || undefined;

  // Keep the latest tag list, reward option, and DecentMemes attachments so
  // the submit handler can build a spec-correct op without re-reading state.
  const tagsRef = useRef<string[]>([]);
  const rewardRef = useRef<RewardOption>('default');
  const decentMemesRef = useRef<DecentMemesMeme[]>([]);

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">PostComposer</h1>
        <p className="text-gray-400 text-sm">
          Rich markdown composer with preview, image/audio/video upload, paste &amp; drag-drop, GIF, emoji, @ mention, templates, code blocks, tag manager (locked defaults + up to 10 total), reward routing (50/50, 100% power, burn, decline), and DecentMemes integration (auto-attached beneficiaries + json_metadata).
        </p>

        <PostComposer
          onSubmit={(body) => {
            const author = 'shaktimaaan';
            const permlink = 're-peaksnaps-demo';

            // Per DecentMemes spec v3, ensure the `decentmemes` tag is present
            // whenever the post embeds at least one meme — promotes the post
            // to the meme-category indexers.
            const memes = decentMemesRef.current;
            const tags = [...tagsRef.current];
            if (memes.length > 0 && !tags.includes(DECENTMEMES_TAG)) {
              tags.push(DECENTMEMES_TAG);
            }

            // json_metadata stamp: every embedded templateId so the rewards
            // watcher can split holding-pool payouts across the unclaimed
            // templates correctly.
            const jsonMetadata: Record<string, unknown> = {
              app: 'peakd/2026.4.3',
              tags,
              image: [],
            };
            const decentMemesMeta = buildDecentMemesMetadata(memes /*, 'peakd' */);
            if (decentMemesMeta) jsonMetadata.decentmemes = decentMemesMeta;

            const commentOp = [
              'comment',
              {
                parent_author: 'peak.snaps',
                parent_permlink: 'snap-container-demo',
                author,
                permlink,
                title: '',
                body,
                json_metadata: JSON.stringify(jsonMetadata),
              },
            ];

            // Merge DecentMemes beneficiaries into comment_options. Use
            // `comment` kind (30% cap, includes the 10% submitter slot)
            // since this demo posts a reply.
            const baseOpts = buildCommentOptions(author, permlink, rewardRef.current);
            const memeBeneficiaries = aggregateDecentMemesBeneficiaries(memes, 'comment');

            let opts = baseOpts;
            if (memeBeneficiaries.length > 0) {
              // If no reward routing was active, fabricate the default options
              // shell so we have somewhere to attach beneficiaries.
              const optsShape =
                baseOpts ?? [
                  'comment_options',
                  {
                    author,
                    permlink,
                    max_accepted_payout: '1000000.000 HBD',
                    percent_hbd: 10000,
                    allow_votes: true,
                    allow_curation_rewards: true,
                    extensions: [] as unknown[],
                  },
                ];
              const optsBody = optsShape[1] as { extensions: unknown[] };
              optsBody.extensions = [
                ...(optsBody.extensions ?? []),
                [0, { beneficiaries: memeBeneficiaries }],
              ];
              opts = optsShape as ReturnType<typeof buildCommentOptions>;
            }

            const ops = opts ? [commentOp, opts] : [commentOp];
            console.log('PostComposer submitted:', body);
            console.log('DecentMemes attachments:', memes);
            console.log('Ops to broadcast:', JSON.stringify(ops, null, 2));
            alert(
              `Submitted with reward "${rewardRef.current}", tags [${tags.join(', ')}], ` +
                `and ${memes.length} DecentMemes meme(s)\n\nCheck the console for the full op array.`,
            );
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
          decentMemesTheme="dark"
          onDecentMemesChange={(memes) => {
            decentMemesRef.current = memes;
            console.log('DecentMemes changed:', memes);
          }}
          showVoteButton={true}
          defaultVoteEnabled={true}
          defaultVotePercent={100}
          onVoteChange={(enabled, percent) => {
            console.log('Vote changed:', enabled, percent);
          }}
          voteLabel="Upvote parent on publish"
        />
      </div>
    </div>
  );
};

export default PostComposerPage;
