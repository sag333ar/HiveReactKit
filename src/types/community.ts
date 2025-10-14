/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CommunityItem {
  id?: number;
  name?: string;
  title?: string;
  about?: string;
  description?: string;
  type_id?: number;
  is_nsfw?: boolean;
  subscribers?: number;
  sum_pending?: number;
  num_authors?: number;
  num_pending?: number;
  team?: string[][];
  avatar_url?: string;
  lang?: string;
  created_at?: string;
  context?: Record<string, any>;
  rank?: number;
  score?: number;
  flag_text?: string;
}

export interface CommunityDetailsResponse {
  jsonrpc: string;
  result: CommunityDetailsResult;
  id: number;
}

export interface CommunityDetailsResult {
  id: number;
  name: string;
  title: string;
  about: string;
  lang: string;
  type_id: number;
  is_nsfw: boolean;
  subscribers: number;
  created_at: string;
  sum_pending: number;
  num_pending: number;
  num_authors: number;
  avatar_url: string;
  description: string;
  flag_text: string;
  team: string[][];
  context: Record<string, any>;
  settings?: Record<string, any>;
}
export interface CommunitySubscriber {
  username: string;
  role: string;
  extra?: string;
  subscribedAt: string;
}

export interface CommunitiesRequestParams {
  limit?: number;
  query?: string;
  last?: string;
}

export interface CommunityAccount {
  id: number;
  name: string;
  balance: string;
  hbd_balance: string;
  reward_hbd_balance: string;
  reward_hive_balance: string;
  reward_vesting_balance: string;
  vesting_shares: string;
  delegated_vesting_shares: string;
  received_vesting_shares: string;
  json_metadata: string;
  posting_json_metadata: string;
  created: string;
  last_post: string;
  last_root_post: string;
  last_vote_time: string;
  post_count: number;
  can_vote: boolean;
  voting_power: number;
  reputation: number;
  // Add other fields as needed
}

export interface CommunityPost {
  id: number;
  author: string;
  permlink: string;
  category: string;
  title: string;
  body: string;
  json_metadata: any;
  created: string;
  last_update: string;
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
  author_payout_value: string;
  pending_payout_value: string;
  promoted: string;
  total_pending_payout_value: string;
  active_votes: any[];
  replies: any[];
  author_reputation: number;
  stats: any;
  beneficiaries: any[];
  max_accepted_payout: string;
  percent_hbd: number;
  url: string;
  payout: number;
  payout_at: string;
  is_paidout: boolean;
  community: string;
  community_title: string;
  author_role: string;
  author_title: string;
  net_votes: number;
  root_author: string;
  root_permlink: string;
  allow_replies: boolean;
  allow_votes: boolean;
  allow_curation_rewards: boolean;
  reblogs: number;
  // Add other fields as needed
}

export interface CommunityActivity {
  id: number;
  type: string;
  date: string;
  msg: string;
  url?: string;
  score?: number;
  // Add other fields as needed based on API response
}
