/**
 * Reward-routing options exposed by PostComposer's reward selector, plus a
 * helper to build the matching Hive `comment_options` operation tuple that
 * should accompany the `comment` op at broadcast time.
 *
 * The composer itself does not broadcast; it emits the chosen option via
 * `onRewardChange`. Consumers call `buildCommentOptions(author, permlink, reward)`
 * to produce the op they append to their `signAndBroadcastTx` array.
 */

export type RewardOption = 'default' | 'power_up' | 'burn' | 'decline';

/** Human-readable labels used by the PostComposer reward dropdown. */
export const REWARD_OPTION_LABELS: Record<RewardOption, string> = {
  default: '50% HBD and 50% HP',
  power_up: '100% Hive Power',
  burn: 'Burn',
  decline: 'Decline',
};

export const REWARD_OPTIONS: RewardOption[] = ['default', 'power_up', 'burn', 'decline'];

type CommentOptionsOp = [
  'comment_options',
  {
    author: string;
    permlink: string;
    allow_votes: boolean;
    allow_curation_rewards: boolean;
    max_accepted_payout: string;
    percent_hbd: number;
    extensions: unknown[];
  },
];

/**
 * Build the Hive `comment_options` op tuple for the chosen reward routing.
 * Returns `null` for the default 50/50 option — Hive treats the absence of
 * `comment_options` as the default, so there is no op to broadcast.
 *
 * Appending the returned tuple to your `[['comment', ...]]` array is all
 * that's needed.
 */
export function buildCommentOptions(
  author: string,
  permlink: string,
  reward: RewardOption,
): CommentOptionsOp | null {
  switch (reward) {
    case 'default':
      return null;
    case 'power_up':
      return [
        'comment_options',
        {
          author,
          permlink,
          allow_votes: true,
          allow_curation_rewards: true,
          max_accepted_payout: '1000000.000 HBD',
          percent_hbd: 0,
          extensions: [],
        },
      ];
    case 'burn':
      return [
        'comment_options',
        {
          author,
          permlink,
          allow_votes: true,
          allow_curation_rewards: true,
          max_accepted_payout: '1000000.000 HBD',
          percent_hbd: 10000,
          extensions: [
            [0, { beneficiaries: [{ account: 'null', weight: 10000 }] }],
          ],
        },
      ];
    case 'decline':
      return [
        'comment_options',
        {
          author,
          permlink,
          allow_votes: true,
          allow_curation_rewards: true,
          max_accepted_payout: '0.000 HBD',
          percent_hbd: 10000,
          extensions: [],
        },
      ];
  }
}
