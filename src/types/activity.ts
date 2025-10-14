/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AccountHistoryItem {
  id: number;
  op: AccountOperation;
  block: number;
  timestamp: string;
  trx_id: string;
  trx_in_block: number;
  op_in_trx: number;
  virtual_op: boolean;
}

export interface AccountOperation {
  type: string;
  value: any;
}

export interface VoteOperation {
  voter: string;
  author: string;
  permlink: string;
  weight: number;
}

export interface CommentOperation {
  parent_author: string;
  parent_permlink: string;
  author: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: string;
}

export interface CustomJsonOperation {
  required_auths: string[];
  required_posting_auths: string[];
  id: string;
  json: string;
}

export interface TransferOperation {
  from: string;
  to: string;
  amount: string;
  memo: string;
}

export interface RewardOperation {
  author: string;
  permlink: string;
  hbd_payout: string;
  hive_payout: string;
  vesting_payout: string;
}

export interface ActivityFilters {
  direction: 'all' | 'in' | 'out';
  general: {
    votes: boolean;
    comments: boolean;
    replies: boolean;
    showOthers: boolean;
  };
  rewards: {
    authorRewards: boolean;
    curationRewards: boolean;
    benefactorRewards: boolean;
  };
  search: string;
}

export interface ActivityItem {
  id: number;
  type: ActivityType;
  direction: 'in' | 'out';
  timestamp: string;
  description: string;
  details: any;
  author?: string;
  permlink?: string;
  voter?: string;
  amount?: string;
  weight?: number;
}

export type ActivityType =
  | 'vote'
  | 'comment'
  | 'reply'
  | 'author_reward'
  | 'curation_reward'
  | 'benefactor_reward'
  | 'transfer'
  | 'custom_json'
  | 'other';
