/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UserChannelItem {
  id: number;
  author: string;
  permlink: string;
  category: string;
  parent_author: string;
  parent_permlink: string;
  title: string;
  body: string;
  json_metadata: string;
  last_update: string;
  created: string;
  active: string;
  last_payout: string;
  depth: number;
  children: number;
  net_rshares: number;
  abs_rshares: number;
  vote_rshares: number;
  children_abs_rshares: number;
  cashout_time: string;
  max_cashout_time: string;
  total_vote_weight: number;
  reward_weight: number;
  total_payout_value: string;
  curator_payout_value: string;
  author_rewards: number;
  net_votes: number;
  root_author: string;
  root_permlink: string;
  max_accepted_payout: string;
  percent_hbd: number;
  allow_replies: boolean;
  allow_votes: boolean;
  allow_curation_rewards: boolean;
  beneficiaries: any[];
  url: string;
  root_title: string;
  pending_payout_value: string;
  total_pending_payout_value: string;
  active_votes: any[];
  replies: string[];
  author_reputation: number;
  promoted: string;
  body_length: number;
  reblogged_by: string[];
  active_votes_count: number;
  author_title: string;
  author_role: string;
  author_about: string;
  author_location: string;
  author_website: string;
  author_cover_image: string;
  author_profile_image: string;
  author_blacklist_description: string;
  author_muted_list_description: string;
  author_reputation_formatted: string;
  author_vests_formatted: string;
  author_balance_formatted: string;
  author_hbd_balance_formatted: string;
  author_savings_hbd_balance_formatted: string;
  author_savings_balance_formatted: string;
  author_vesting_shares_formatted: string;
  author_delegated_vesting_shares_formatted: string;
  author_received_vesting_shares_formatted: string;
  author_vesting_withdraw_rate_formatted: string;
  author_next_vesting_withdrawal_formatted: string;
  author_vesting_withdraw_rate: number;
  author_next_vesting_withdrawal: string;
  author_vesting_shares: string;
  author_delegated_vesting_shares: string;
  author_received_vesting_shares: string;
  author_balance: string;
  author_hbd_balance: string;
  author_savings_hbd_balance: string;
  author_savings_balance: string;
  author_post_count: number;
  author_voting_power: number;
  author_voting_manabar: any;
  author_downvote_manabar: any;
  author_rc_manabar: any;
}

export interface UserChannelParams {
  username: string;
  sortBy?: "posts" | "comments" | "replies";
  limit?: number;
  startAuthor?: string;
  startPermlink?: string;
  observer?: string;
}

export interface UserChannelResponse {
  result: UserChannelItem[];
}

// Simplified interface for UI display
export interface ActivityDisplayItem {
  id: number;
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  category: string;
  net_votes: number;
  children: number;
  total_payout_value: string;
  pending_payout_value: string;
  url: string;
  type: "post" | "comment";
}
