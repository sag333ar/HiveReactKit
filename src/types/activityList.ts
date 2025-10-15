// Account History Types (for get_account_history API)
export interface AccountHistoryOperation {
  type: string;
  value: any;
}

export interface AccountHistoryItem {
  index: number;
  timestamp: string;
  block: number;
  trx_in_block: number;
  op_in_trx: number;
  virtual_op: boolean;
  trx_id: string;
  op: AccountHistoryOperation;
}

export interface AccountHistoryResponse {
  id: number;
  jsonrpc: string;
  result: AccountHistoryItem[];
}

// Activity List Types
export interface ActivityListItem {
  id: string;
  type: 'vote' | 'comment' | 'custom_json' | 'comment_options' | 'effective_comment_vote' | 'curation_reward' | 'author_reward' | 'comment_benefactor_reward' | 'other';
  direction: 'in' | 'out';
  timestamp: string;
  block: number;
  description: string;
  details: any;
  index: number;
  author?: string;
  permlink?: string;
  voter?: string;
  weight?: number;
  payout?: string;
  community?: string;
  curator?: string;
  reward?: string;
  hbd_payout?: string;
  hive_payout?: string;
  vesting_payout?: string;
  benefactor?: string;
  parent_author?: string;
  parent_permlink?: string;
}

// Filter types
export type DirectionFilter = 'all' | 'in' | 'out';
export type GeneralFilter = 'all' | 'votes' | 'comments' | 'replies' | 'curation' | 'others';
export type RewardFilter = 'all' | 'author' | 'curation' | 'benefactor';
