/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHiveClient } from "../config/hiveEndpoint";
import {
  AccountHistoryItem,
  AccountHistoryResponse,
  ActivityListItem,
  DirectionFilter,
  GeneralFilter,
  RewardFilter
} from "@/types/activityList";

// Shared dhive client — address is updated at runtime via setHiveApiEndpoint().
const dhiveClient = getHiveClient();

// Hive operation → bit index in the 128-bit operation filter bitmask used by
// condenser_api.get_account_history. Bits 0–63 go into operation_filter_low,
// bits 64–127 into operation_filter_high. Mapping mirrors the order of the
// `operation` variant in libraries/protocol/include/hive/protocol/operations.hpp.
const OP_BIT: Record<string, number> = {
  vote: 0,
  comment: 1,
  transfer: 2,
  transfer_to_vesting: 3,
  withdraw_vesting: 4,
  limit_order_create: 5,
  limit_order_cancel: 6,
  feed_publish: 7,
  convert: 8,
  account_create: 9,
  account_update: 10,
  witness_update: 11,
  account_witness_vote: 12,
  account_witness_proxy: 13,
  pow: 14,
  custom: 15,
  report_over_production: 16,
  delete_comment: 17,
  custom_json: 18,
  comment_options: 19,
  set_withdraw_vesting_route: 20,
  limit_order_create2: 21,
  claim_account: 22,
  create_claimed_account: 23,
  request_account_recovery: 24,
  recover_account: 25,
  change_recovery_account: 26,
  escrow_transfer: 27,
  escrow_dispute: 28,
  escrow_release: 29,
  pow2: 30,
  escrow_approve: 31,
  transfer_to_savings: 32,
  transfer_from_savings: 33,
  cancel_transfer_from_savings: 34,
  custom_binary: 35,
  decline_voting_rights: 36,
  reset_account: 37,
  set_reset_account: 38,
  claim_reward_balance: 39,
  delegate_vesting_shares: 40,
  account_create_with_delegation: 41,
  witness_set_properties: 42,
  account_update2: 43,
  create_proposal: 44,
  update_proposal_votes: 45,
  remove_proposal: 46,
  update_proposal: 47,
  collateralized_convert: 48,
  recurrent_transfer: 49,
  fill_convert_request: 50,
  author_reward: 51,
  curation_reward: 52,
  comment_reward: 53,
  liquidity_reward: 54,
  interest: 55,
  fill_vesting_withdraw: 56,
  fill_order: 57,
  shutdown_witness: 58,
  fill_transfer_from_savings: 59,
  hardfork: 60,
  comment_payout_update: 61,
  return_vesting_delegation: 62,
  comment_benefactor_reward: 63,
  producer_reward: 64,
  clear_null_account_balance: 65,
  proposal_pay: 66,
  dhf_funding: 67,
  hardfork_hive: 68,
  hardfork_hive_restore: 69,
  delayed_voting: 70,
  consensus_required: 71,
  dhf_conversion: 72,
  expired_account_notification: 73,
  changed_recovery_account: 74,
  transfer_to_vesting_completed: 75,
  pow_reward: 76,
  vesting_shares_split: 77,
  account_created: 78,
  fill_collateralized_convert_request: 79,
  system_warning: 80,
  fill_recurrent_transfer: 81,
  failed_recurrent_transfer: 82,
};

export function buildOperationFilterMask(op?: string): { low: string; high: string } | null {
  if (!op || op === 'all') return null;
  const bit = OP_BIT[op];
  if (bit === undefined) return null;
  if (bit < 64) {
    return { low: (1n << BigInt(bit)).toString(), high: '0' };
  }
  return { low: '0', high: (1n << BigInt(bit - 64)).toString() };
}

class ActivityListService {
  /**
   * Get account history using condenser_api.get_account_history
   * @param username - Hive username
   * @param start - Starting operation index (-1 for most recent)
   * @param limit - Number of operations to fetch
   * @param operationFilterLow - Operation filter low (optional)
   * @param operationFilterHigh - Operation filter high (optional)
   * @returns Promise<AccountHistoryItem[]>
   */
  async getAccountHistory(
    username: string,
    start: number = -1,
    limit: number = 1000,
    operationFilterLow?: string,
    operationFilterHigh?: string
  ): Promise<AccountHistoryItem[]> {
    try {
      const params: any[] = [username, start, limit];

      // Add operation filters for pagination if provided
      if (operationFilterLow !== undefined && operationFilterHigh !== undefined) {
        params.push(operationFilterLow, operationFilterHigh);
      }

      const response: any[] = await dhiveClient.call(
        "condenser_api",
        "get_account_history",
        params
      );

      // Convert the array response to AccountHistoryItem format
      return response.map(([index, opData]) => ({
        index,
        block: opData.block,
        op: {
          type: opData.op[0],
          value: opData.op[1]
        },
        op_in_trx: opData.op_in_trx,
        timestamp: opData.timestamp,
        trx_id: opData.trx_id,
        trx_in_block: opData.trx_in_block,
        virtual_op: opData.virtual_op
      }));
    } catch (error) {
      console.error("Error fetching account history:", error);
      return [];
    }
  }

  /**
   * Get the next page of account history for pagination
   * @param username - Hive username
   * @param lastIndex - Last operation index from previous page
   * @param limit - Number of operations to fetch
   * @returns Promise<AccountHistoryItem[]>
   */
  async getNextAccountHistoryPage(
    username: string,
    lastIndex: number,
    limit: number = 1000,
    operationFilterLow?: string,
    operationFilterHigh?: string,
  ): Promise<AccountHistoryItem[]> {
    try {
      // For pagination, we need to get operations starting from lastIndex - 1
      // to get the next batch of older operations (lower indices)
      const startIndex = lastIndex - 1;

      const params: any[] = [username, startIndex, limit];
      if (operationFilterLow !== undefined && operationFilterHigh !== undefined) {
        params.push(operationFilterLow, operationFilterHigh);
      }

      const response: any[] = await dhiveClient.call(
        "condenser_api",
        "get_account_history",
        params,
      );

      // Convert the array response to AccountHistoryItem format
      const items = response.map(([index, opData]) => ({
        index,
        block: opData.block,
        op: {
          type: opData.op[0],
          value: opData.op[1]
        },
        op_in_trx: opData.op_in_trx,
        timestamp: opData.timestamp,
        trx_id: opData.trx_id,
        trx_in_block: opData.trx_in_block,
        virtual_op: opData.virtual_op
      }));

      // Filter out any items that have index >= lastIndex to avoid duplicates
      // and ensure we only get older operations
      return items.filter(item => item.index < lastIndex);
    } catch (error) {
      console.error("Error fetching next page of account history:", error);
      return [];
    }
  }

  /**
   * Convert account history items to activity list items
   * @param historyItems - Raw account history items
   * @param username - The account we're viewing history for
   * @returns ActivityListItem[]
   */
  convertToActivityListItems(
    historyItems: AccountHistoryItem[],
    username: string
  ): ActivityListItem[] {
    return historyItems
      .filter(item => {
        // Hide a couple of internal/duplicated virtual ops that aren't meaningful
        // to users. Everything else flows through so the grouped operation
        // filter (vote / transfer / witness / etc.) can match against op.type.
        const operationType = item.op.type;
        return operationType !== 'comment_payout_update' &&
               operationType !== 'transfer_to_vesting_completed' &&
               operationType !== 'producer_reward';
      })
      .map(item => {
        const activityItem = this.parseOperation(item, username);
        return {
          id: `${item.index}-${item.trx_id}`,
          type: activityItem.type,
          op: item.op.type,
          direction: activityItem.direction,
          timestamp: item.timestamp,
          block: item.block,
          description: activityItem.description,
          details: item.op.value,
          index: item.index,
          ...activityItem.extraFields
        };
      }).filter(item => item !== null) as ActivityListItem[];
  }

  /**
   * Parse individual operation and determine activity details
   * @param historyItem - Account history item
   * @param username - The account we're viewing history for
   * @returns Parsed activity data
   */
  private parseOperation(historyItem: AccountHistoryItem, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } | null {
    const { op } = historyItem;
    const operationType = op.type;
    const value = op.value;

    switch (operationType) {
      case 'vote':
        return this.parseVoteOperation(value, username);

      case 'comment':
        return this.parseCommentOperation(value, username);

      case 'custom_json':
        return this.parseCustomJsonOperation(value, username);

      case 'comment_options':
        return this.parseCommentOptionsOperation(value, username);

      case 'effective_comment_vote':
        return this.parseEffectiveCommentVoteOperation(value, username);

      case 'curation_reward':
        return this.parseCurationRewardOperation(value, username);

      case 'author_reward':
        return this.parseAuthorRewardOperation(value, username);

      case 'comment_benefactor_reward':
        return this.parseCommentBenefactorRewardOperation(value, username);

      case 'transfer':
      case 'transfer_to_savings':
      case 'transfer_from_savings':
      case 'recurrent_transfer':
        return this.parseTransferOperation(operationType, value, username);

      default:
        return {
          type: 'other',
          direction: 'out',
          description: `${operationType} operation`,
          extraFields: {}
        };
    }
  }

  private parseVoteOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { voter, author, permlink, weight } = value;
    const isIncoming = author === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';
    const weightPercentNum = weight / 100;
    const weightPercent = weightPercentNum.toFixed(2);

    let description = '';
    if (isIncoming) {
      description = `${voter} voted ${author}/${permlink} with ${weightPercent}%`;
    } else {
      description = `Voted ${author}/${permlink} with ${weightPercent}%`;
    }

    return {
      type: 'vote',
      direction,
      description,
      extraFields: {
        voter,
        author,
        permlink,
        weight: weightPercentNum
      }
    };
  }

  private parseCommentOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { author, parent_author, parent_permlink, permlink } = value;
    const isIncoming = parent_author === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    // Show parent_author if available, otherwise show the comment author
    const displayAuthor = parent_author || author;
    const description = `Commented on ${parent_permlink} by ${displayAuthor}.`;

    return {
      type: 'comment',
      direction,
      description,
      extraFields: {
        author,
        permlink,
        parent_author,
        parent_permlink
      }
    };
  }

  private parseCustomJsonOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { id, json, required_auths, required_posting_auths } = value;

    // Try to parse JSON for more details
    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(json);
    } catch (e) {
      // JSON parsing failed, use raw json
    }

    let description = `Custom Json`;

    // Handle specific custom operations
    if (id === 'follow') {
      const [action, followData] = parsedJson;
      if (action === 'follow') {
        description = `Custom Json`;
      }
    }

    return {
      type: 'custom_json',
      direction: 'out',
      description,
      extraFields: {}
    };
  }

  private parseCommentOptionsOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { author, permlink, max_accepted_payout } = value;
    const direction: 'in' | 'out' = 'out';

    const description = `Comment Payout Update`;

    return {
      type: 'comment_options',
      direction,
      description,
      extraFields: {
        author,
        permlink,
        payout: max_accepted_payout
      }
    };
  }

  private parseEffectiveCommentVoteOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { voter, author, permlink, pending_payout } = value;
    const isIncoming = author === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    const description = isIncoming
      ? `${voter} voted on ${author}/${permlink} (effective vote)`
      : `Effective vote on ${author}/${permlink}`;

    return {
      type: 'effective_comment_vote',
      direction,
      description,
      extraFields: {
        voter,
        author,
        permlink,
        payout: pending_payout
      }
    };
  }

  private parseCurationRewardOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { author, curator, permlink, reward } = value;
    const isIncoming = curator === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    // Convert VESTS to HP (Hive Power) - rough approximation: 1 VESTS ≈ 0.000001 HP
    const vestsAmount = parseFloat(reward.split(' ')[0]);
    const hpAmount = (vestsAmount * 0.000001).toFixed(3);
    const formattedReward = `${hpAmount} HP`;

    const description = `Curation reward for ${curator}/${permlink} by ${author}`;

    return {
      type: 'curation_reward',
      direction,
      description,
      extraFields: {
        author,
        curator,
        permlink,
        reward: formattedReward
      }
    };
  }

  private parseAuthorRewardOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { author, permlink, hbd_payout, hive_payout, vesting_payout } = value;
    const isIncoming = author === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    // Convert vesting_payout to HP
    const vestsAmount = parseFloat(vesting_payout.split(' ')[0]);
    const hpAmount = (vestsAmount * 0.000001).toFixed(3);

    // Extract HBD and HIVE amounts
    const hbdAmount = hbd_payout.split(' ')[0];
    const hiveAmount = hive_payout.split(' ')[0];

    const description = `Author reward: ${hbdAmount} HBD, ${hiveAmount} HIVE, ${hpAmount} HP for ${permlink}`;

    return {
      type: 'author_reward',
      direction,
      description,
      extraFields: {
        author,
        permlink,
        hbd_payout,
        hive_payout,
        vesting_payout
      }
    };
  }

  private parseTransferOperation(operationType: string, value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { from, to, amount, memo } = value;
    const isIncoming = to === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    const labelMap: Record<string, string> = {
      transfer: 'Transfer',
      transfer_to_savings: 'Transfer to savings',
      transfer_from_savings: 'Transfer from savings',
      recurrent_transfer: 'Recurrent transfer',
    };
    const label = labelMap[operationType] || 'Transfer';

    const description = isIncoming
      ? `${label}: ${from} → ${to} (${amount})`
      : `${label}: ${from} → ${to} (${amount})`;

    return {
      type: 'transfer',
      direction,
      description,
      extraFields: {
        from,
        to,
        amount,
        memo,
      },
    };
  }

  private parseCommentBenefactorRewardOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { author, benefactor, permlink, hbd_payout, hive_payout, vesting_payout } = value;
    const isIncoming = benefactor === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    // Convert vesting_payout to HP
    const vestsAmount = parseFloat(vesting_payout.split(' ')[0]);
    const hpAmount = (vestsAmount * 0.000001).toFixed(3);

    // Extract HBD and HIVE amounts
    const hbdAmount = hbd_payout.split(' ')[0];
    const hiveAmount = hive_payout.split(' ')[0];

    const description = `Benefactor reward on ${permlink} by ${author}: ${hbdAmount} HBD, ${hiveAmount} HIVE, ${hpAmount} HP`;

    return {
      type: 'comment_benefactor_reward',
      direction,
      description,
      extraFields: {
        author,
        benefactor,
        permlink,
        hbd_payout,
        hive_payout,
        vesting_payout
      }
    };
  }



  /**
   * Filter activities by direction (in/out)
   * @param activities - Activity list items
   * @param filter - Direction filter
   * @returns Filtered activities
   */
  filterByDirection(activities: ActivityListItem[], filter: DirectionFilter): ActivityListItem[] {
    if (filter === 'all') return activities;
    return activities.filter(activity => activity.direction === filter);
  }

  /**
   * Filter activities by general type
   * @param activities - Activity list items
   * @param filter - General filter
   * @returns Filtered activities
   */
  filterByGeneralType(activities: ActivityListItem[], filter: GeneralFilter): ActivityListItem[] {
    if (filter === 'all') return activities;

    switch (filter) {
      case 'votes':
        return activities.filter(activity => activity.type === 'vote' || activity.type === 'effective_comment_vote');
      case 'comments':
        return activities.filter(activity => activity.type === 'comment');
      case 'replies':
        return activities.filter(activity => activity.type === 'comment' && activity.direction === 'in');
      case 'others':
        return activities.filter(activity => activity.type === 'custom_json' || activity.type === 'comment_options' || activity.type === 'other');
      default:
        return activities;
    }
  }

  /**
   * Filter activities by reward type
   * @param activities - Activity list items
   * @param filter - Reward filter
   * @returns Filtered activities
   */
  filterByRewardType(activities: ActivityListItem[], filter: RewardFilter): ActivityListItem[] {
    if (filter === 'all') return activities;

    // Note: This is a simplified implementation
    // In a real implementation, you'd need to check the actual reward data
    switch (filter) {
      case 'author':
        return activities.filter(activity =>
          activity.type === 'effective_comment_vote' && activity.direction === 'in'
        );
      case 'curation':
        return activities.filter(activity =>
          activity.type === 'effective_comment_vote' && activity.direction === 'out'
        );
      case 'benefactor':
        return activities.filter(activity =>
          activity.type === 'comment_options' && activity.details?.beneficiaries
        );
      default:
        return activities;
    }
  }

  /**
   * Search activities by text
   * @param activities - Activity list items
   * @param searchText - Search text
   * @returns Filtered activities
   */
  searchActivities(activities: ActivityListItem[], searchText: string): ActivityListItem[] {
    if (!searchText.trim()) return activities;

    const lowerSearchText = searchText.toLowerCase();
    return activities.filter(activity =>
      activity.description.toLowerCase().includes(lowerSearchText) ||
      activity.author?.toLowerCase().includes(lowerSearchText) ||
      activity.permlink?.toLowerCase().includes(lowerSearchText) ||
      activity.voter?.toLowerCase().includes(lowerSearchText)
    );
  }

  /**
   * Get relative time string
   * @param timestamp - ISO timestamp
   * @returns Relative time string
   */
  getRelativeTime(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSeconds < 60) {
        return `${diffSeconds} seconds ago`;
      } else if (diffMinutes < 60) {
        return `${diffMinutes} minutes ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      console.error("Error calculating relative time:", error);
      return timestamp;
    }
  }
}

export const activityListService = new ActivityListService();
