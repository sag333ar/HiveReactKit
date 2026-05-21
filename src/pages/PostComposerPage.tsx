import { PostComposer } from '../components/comments/AddCommentInput';
import { type RewardOption } from '../utils/commentOptions';
import { mergeBeneficiariesIntoCommentOptions, type Beneficiary } from '../utils/beneficiaries';
import {
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

  // Latest state from the composer. DecentMemes beneficiaries are already
  // merged into `beneficiariesRef` by the composer (same auto-injection
  // pattern as the `threespeakfund` 10% video lock), so the broadcast
  // step just hands the merged list to `mergeBeneficiariesIntoCommentOptions`.
  // `decentMemesRef` is only kept for the `json_metadata.decentmemes`
  // template-id stamp — the rewards watcher needs that to attribute
  // multi-meme payouts.
  const tagsRef = useRef<string[]>([]);
  const rewardRef = useRef<RewardOption>('default');
  const beneficiariesRef = useRef<Beneficiary[]>([]);
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
            const parentAuthor = 'peak.snaps';

            const memes = decentMemesRef.current;
            const tags = [...tagsRef.current];
            // Per DecentMemes spec v3, the `decentmemes` tag must be present
            // whenever the post embeds at least one meme.
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
                parent_author: parentAuthor,
                parent_permlink: 'snap-container-demo',
                author,
                permlink,
                title: '',
                body,
                json_metadata: JSON.stringify(jsonMetadata),
              },
            ];

            // Beneficiaries already include the DecentMemes auto-injected
            // entries (and the 3Speak fund lock if a video is attached).
            // `mergeBeneficiariesIntoCommentOptions` builds the right
            // `comment_options` op for both default and non-default rewards.
            const opts = mergeBeneficiariesIntoCommentOptions(
              author,
              permlink,
              rewardRef.current,
              beneficiariesRef.current,
            );

            const ops = opts ? [commentOp, opts] : [commentOp];
            console.log('PostComposer submitted:', body);
            console.log('Beneficiaries (merged):', beneficiariesRef.current);
            console.log('DecentMemes attachments:', memes);
            console.log('Ops to broadcast:', JSON.stringify(ops, null, 2));
            alert(
              `Submitted with reward "${rewardRef.current}", tags [${tags.join(', ')}], ` +
                `${beneficiariesRef.current.length} beneficiary entry/ies, ` +
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
          onBeneficiariesChange={(beneficiaries) => {
            beneficiariesRef.current = beneficiaries;
            console.log('Beneficiaries changed (merged):', beneficiaries);
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
