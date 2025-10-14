/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserProfileResponse {
  id: number;
  jsonrpc: string;
  result: {
    active: string;
    blacklists: any[];
    created: string;
    id: number;
    metadata: {
      profile: {
        about: string;
        blacklist_description: string;
        cover_image: string;
        location: string;
        muted_list_description: string;
        name: string;
        profile_image: string;
        website: string;
      };
    };
    name: string;
    post_count: number;
    reputation: number;
    stats: {
      followers: number;
      following: number;
      rank: number;
    };
  };
}

export interface Follower {
  follower: string;
  following: string;
  what: string[];
}

export interface Following {
  follower: string;
  following: string;
  what: string[];
}

export interface User {
  username: string;
  token: string;
}

export interface Account {
  id: number;
  name: string;
  balance: string;
  hbd_balance: string;
  vesting_shares: string;
  voting_power: number;
  last_post: string;
  last_root_post: string;
  posting_json_metadata: string;
  reputation: number;
  can_vote: boolean;
  comment_count: number;
  created: string;
  curation_rewards: number;
  delayed_votes: any[];
  delegated_vesting_shares: string;
  downvote_manabar: {
    current_mana: number;
    last_update_time: number;
  };
  governance_vote_expiration_ts: string;
  guest_bloggers: any[];
  hbd_last_interest_payment: string;
  hbd_seconds: string;
  hbd_seconds_last_update: string;
  json_metadata: string;
  last_account_recovery: string;
  last_account_update: string;
  last_owner_update: string;
  last_vote_time: string;
  lifetime_vote_count: number;
  market_history: any[];
  memo_key: string;
  mined: boolean;
  next_vesting_withdrawal: string;
  open_recurrent_transfers: number;
  other_history: any[];
  owner: {
    account_auths: any[];
    key_auths: [string, number][];
    weight_threshold: number;
  };
  pending_claimed_accounts: number;
  pending_transfers: number;
  post_bandwidth: number;
  post_count: number;
  post_history: any[];
  post_voting_power: string;
  posting: {
    account_auths: [string, number][];
    key_auths: [string, number][];
    weight_threshold: number;
  };
  posting_rewards: number;
  previous_owner_update: string;
  proxied_vsf_votes: number[];
  proxy: string;
  received_vesting_shares: string;
  recovery_account: string;
  reset_account: string;
  reward_hbd_balance: string;
  reward_hive_balance: string;
  reward_vesting_balance: string;
  reward_vesting_hive: string;
  savings_balance: string;
  savings_hbd_balance: string;
  savings_hbd_last_interest_payment: string;
  savings_hbd_seconds: string;
  savings_hbd_seconds_last_update: string;
  savings_withdraw_requests: number;
  tags_usage: any[];
  to_withdraw: number;
  transfer_history: any[];
  vesting_balance: string;
  vesting_withdraw_rate: string;
  vote_history: any[];
  voting_manabar: {
    current_mana: number;
    last_update_time: number;
  };
  withdraw_routes: number;
  withdrawn: number;
  witness_votes: string[];
  witnesses_voted_for: number;
  active: {
    account_auths: any[];
    key_auths: [string, number][];
    weight_threshold: number;
  };
}
