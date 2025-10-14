/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "@hiveio/dhive";
import {
  AccountHistoryItem,
  AccountHistoryResponse,
  ActivityListItem,
  DirectionFilter,
  GeneralFilter,
  RewardFilter
} from "@/types/activityList";

// Initialize DHive client
const dhiveClient = new Client([
  "https://api.hive.blog",
  "https://api.syncad.com",
  "https://api.deathwing.me",
]);

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
   * Convert account history items to activity list items
   * @param historyItems - Raw account history items
   * @param username - The account we're viewing history for
   * @returns ActivityListItem[]
   */
  convertToActivityListItems(
    historyItems: AccountHistoryItem[],
    username: string
  ): ActivityListItem[] {
    return historyItems.map(item => {
      const activityItem = this.parseOperation(item, username);
      return {
        id: `${item.index}-${item.trx_id}`,
        type: activityItem.type,
        direction: activityItem.direction,
        timestamp: item.timestamp,
        block: item.block,
        description: activityItem.description,
        details: item.op.value,
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
    const weightPercent = (weight / 100).toFixed(0);

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
        weight: parseInt(weightPercent)
      }
    };
  }

  private parseCommentOperation(value: any, username: string): {
    type: ActivityListItem['type'];
    direction: ActivityListItem['direction'];
    description: string;
    extraFields: Partial<ActivityListItem>;
  } {
    const { author, permlink, parent_author, parent_permlink, title } = value;
    const isIncoming = parent_author === username;
    const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

    let description = '';
    if (parent_author === '') {
      // This is a post
      description = isIncoming
        ? `Published post "${title}" in community ${value.parent_permlink}`
        : `Commented on ${parent_author}/${parent_permlink}`;
    } else {
      // This is a comment/reply
      description = isIncoming
        ? `${author} commented on ${parent_author}/${parent_permlink}`
        : `Commented on ${parent_author}/${parent_permlink}`;
    }

    return {
      type: 'comment',
      direction,
      description,
      extraFields: {
        author,
        permlink,
        community: value.parent_permlink
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
