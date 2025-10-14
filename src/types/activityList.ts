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
  type: 'vote' | 'comment' | 'custom_json' | 'comment_options' | 'effective_comment_vote' | 'other';
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
}

// Filter types
export type DirectionFilter = 'all' | 'in' | 'out';
export type GeneralFilter = 'all' | 'votes' | 'comments' | 'replies' | 'others';
export type RewardFilter = 'all' | 'author' | 'curation' | 'benefactor';
