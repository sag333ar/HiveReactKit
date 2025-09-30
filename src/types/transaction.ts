/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TransactionHistoryItem {
  id: number;
  trx_id: string;
  block: number;
  trx_in_block: number;
  op_in_trx: number;
  virtual_op: number;
  timestamp: string;
  op: any;
}

export interface TransactionHistoryParams {
  account: string;
  index?: number;
  limit?: number;
  start?: number;
  stop?: number;
}

export interface TransactionHistoryResponse {
  result: TransactionHistoryItem[];
}

// Common operation types that might appear in transaction history
export interface TransferOperation {
  type: 'transfer';
  value: {
    from: string;
    to: string;
    amount: string;
    memo: string;
  };
}

export interface VoteOperation {
  type: 'vote';
  value: {
    voter: string;
    author: string;
    permlink: string;
    weight: number;
  };
}

export interface CommentOperation {
  type: 'comment';
  value: {
    parent_author: string;
    parent_permlink: string;
    author: string;
    permlink: string;
    title: string;
    body: string;
    json_metadata: string;
  };
}

export interface CustomJsonOperation {
  type: 'custom_json';
  value: {
    required_auths: string[];
    required_posting_auths: string[];
    id: string;
    json: string;
  };
}

export type Operation = 
  | TransferOperation 
  | VoteOperation 
  | CommentOperation 
  | CustomJsonOperation;
