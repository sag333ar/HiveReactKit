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
  type: 'vote' | 'comment' | 'custom_json' | 'comment_options' | 'effective_comment_vote' | 'curation_reward' | 'author_reward' | 'comment_benefactor_reward' | 'transfer' | 'other';
  op?: string;
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
  // Transfer-specific fields (transfer, transfer_to_savings, transfer_from_savings, recurrent_transfer)
  from?: string;
  to?: string;
  amount?: string;
  memo?: string;
}

// Filter types
export type DirectionFilter = 'all' | 'in' | 'out';
export type GeneralFilter = 'all' | 'votes' | 'comments' | 'replies' | 'curation' | 'others';
export type RewardFilter = 'all' | 'author' | 'curation' | 'benefactor';

// Operation filter — value is either 'all' or a raw Hive operation name (e.g. 'vote')
export type OperationFilter = string;

export interface OperationFilterOption {
  value: string;
  label: string;
}

export interface OperationFilterGroup {
  label: string;
  options: OperationFilterOption[];
}

// Taxonomy mirrors the grouped operation filter used on hivehub.dev account pages.
export const OPERATION_FILTER_GROUPS: OperationFilterGroup[] = [
  {
    label: 'Social Activities',
    options: [
      { value: 'vote', label: 'Vote' },
      { value: 'comment', label: 'Comment' },
      { value: 'delete_comment', label: 'Delete Comment' },
      { value: 'comment_options', label: 'Comment Options' },
    ],
  },
  {
    label: 'DApps',
    options: [
      { value: 'custom_json', label: 'Custom Json' },
    ],
  },
  {
    label: 'Wallet & Financial',
    options: [
      { value: 'transfer', label: 'Transfer' },
      { value: 'transfer_to_vesting', label: 'Transfer To Vesting' },
      { value: 'withdraw_vesting', label: 'Withdraw Vesting' },
      { value: 'delegate_vesting_shares', label: 'Delegate Vesting Shares' },
      { value: 'set_withdraw_vesting_route', label: 'Set Withdraw Vesting Route' },
      { value: 'transfer_to_savings', label: 'Transfer To Savings' },
      { value: 'transfer_from_savings', label: 'Transfer From Savings' },
      { value: 'cancel_transfer_from_savings', label: 'Cancel Transfer From Savings' },
      { value: 'recurrent_transfer', label: 'Recurrent Transfer' },
      { value: 'limit_order_create', label: 'Limit Order Create' },
      { value: 'limit_order_create2', label: 'Limit Order Create2' },
      { value: 'limit_order_cancel', label: 'Limit Order Cancel' },
      { value: 'convert', label: 'Convert' },
      { value: 'collateralized_convert', label: 'Collateralized Convert' },
      { value: 'fill_order', label: 'Fill Order' },
      { value: 'fill_transfer_from_savings', label: 'Fill Transfer From Savings' },
      { value: 'fill_convert_request', label: 'Fill Convert Request' },
      { value: 'fill_vesting_withdraw', label: 'Fill Vesting Withdraw' },
    ],
  },
  {
    label: 'Reward Distribution',
    options: [
      { value: 'claim_reward_balance', label: 'Claim Reward Balance' },
      { value: 'comment_reward', label: 'Comment Reward' },
      { value: 'curation_reward', label: 'Curation Reward' },
      { value: 'author_reward', label: 'Author Reward' },
      { value: 'comment_benefactor_reward', label: 'Comment Benefactor Reward' },
      { value: 'interest', label: 'Interest' },
    ],
  },
  {
    label: 'Governance',
    options: [
      { value: 'account_witness_vote', label: 'Account Witness Vote' },
      { value: 'update_proposal_votes', label: 'Update Proposal Votes' },
      { value: 'account_witness_proxy', label: 'Account Witness Proxy' },
      { value: 'witness_update', label: 'Witness Update' },
      { value: 'witness_set_properties', label: 'Witness Set Properties' },
      { value: 'feed_publish', label: 'Feed Publish' },
      { value: 'create_proposal', label: 'Create Proposal' },
      { value: 'update_proposal', label: 'Update Proposal' },
      { value: 'remove_proposal', label: 'Remove Proposal' },
      { value: 'decline_voting_rights', label: 'Decline Voting Rights' },
    ],
  },
  {
    label: 'Account Management',
    options: [
      { value: 'account_update', label: 'Account Update' },
      { value: 'account_update2', label: 'Account Update2' },
      { value: 'account_create', label: 'Account Create' },
      { value: 'account_create_with_delegation', label: 'Account Create With Delegation' },
      { value: 'claim_account', label: 'Claim Account' },
      { value: 'create_claimed_account', label: 'Create Claimed Account' },
      { value: 'request_account_recovery', label: 'Request Account Recovery' },
      { value: 'recover_account', label: 'Recover Account' },
      { value: 'change_recovery_account', label: 'Change Recovery Account' },
      { value: 'reset_account', label: 'Reset Account' },
      { value: 'set_reset_account', label: 'Set Reset Account' },
    ],
  },
  {
    label: 'Others / Advanced',
    options: [
      { value: 'escrow_transfer', label: 'Escrow Transfer' },
      { value: 'escrow_dispute', label: 'Escrow Dispute' },
      { value: 'escrow_release', label: 'Escrow Release' },
      { value: 'escrow_approve', label: 'Escrow Approve' },
      { value: 'pow', label: 'Pow' },
      { value: 'pow2', label: 'Pow2' },
    ],
  },
];
