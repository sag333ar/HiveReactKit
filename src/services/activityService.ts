import { AccountHistoryItem, ActivityItem, ActivityType } from "@/types/activity";

class ActivityService {
  private readonly HIVE_API_URL = 'https://api.hive.blog';

  async getAccountHistory(
    username: string,
    start: number = -1,
    limit: number = 1000,
    operationFilterLow?: string,
    operationFilterHigh?: string
  ): Promise<AccountHistoryItem[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_account_history',
      params: [username, start, limit, operationFilterLow, operationFilterHigh],
      id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result.map((item: any) => ({
      id: item[0],
      op: {
        type: item[1].op[0],
        value: item[1].op[1],
      },
      block: item[1].block,
      timestamp: item[1].timestamp,
      trx_id: item[1].trx_id,
      trx_in_block: item[1].trx_in_block,
      op_in_trx: item[1].op_in_trx,
      virtual_op: item[1].virtual_op,
    }));
  }

  parseActivityItems(historyItems: AccountHistoryItem[], username: string): ActivityItem[] {
    const activities: ActivityItem[] = [];

    for (const item of historyItems) {
      const activity = this.parseHistoryItem(item, username);
      if (activity) {
        activities.push(activity);
      }
    }

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private parseHistoryItem(item: AccountHistoryItem, username: string): ActivityItem | null {
    const { op, timestamp, id } = item;
    const { type, value } = op;

    switch (type) {
      case 'vote':
        return this.parseVoteActivity(value, timestamp, id, username);
      case 'comment':
        return this.parseCommentActivity(value, timestamp, id, username);
      case 'author_reward':
      case 'curation_reward':
      case 'comment_benefactor_reward':
        return this.parseRewardActivity(type, value, timestamp, id);
      case 'transfer':
        return this.parseTransferActivity(value, timestamp, id, username);
      case 'custom_json':
        return this.parseCustomJsonActivity(value, timestamp, id);
      default:
        return this.parseOtherActivity(type, value, timestamp, id);
    }
  }

  private parseVoteActivity(value: any, timestamp: string, id: number, username: string): ActivityItem {
    const { voter, author, permlink, weight } = value;
    const isIncoming = author === username;
    const direction = isIncoming ? 'in' : 'out';
    const percentage = (weight / 100).toFixed(0);

    return {
      id,
      type: 'vote',
      direction,
      timestamp,
      description: isIncoming
        ? `${voter} voted ${permlink} by ${author} with ${percentage}%`
        : `Voted ${permlink} by ${author} with ${percentage}%`,
      details: value,
      author,
      permlink,
      voter,
      weight: parseInt(percentage),
    };
  }

  private parseCommentActivity(value: any, timestamp: string, id: number, username: string): ActivityItem {
    const { parent_author, parent_permlink, author, permlink, title, body } = value;
    const isReply = parent_author && parent_author !== '';
    const isIncoming = parent_author === username;
    const direction = isIncoming ? 'in' : 'out';

    let description = '';
    if (isReply) {
      description = isIncoming
        ? `${author} replied to ${permlink} by ${parent_author}`
        : `Replied to ${permlink} by ${parent_author}`;
    } else {
      description = isIncoming
        ? `${author} commented on ${permlink} by ${parent_author}`
        : `Commented on ${permlink} by ${parent_author}`;
    }

    return {
      id,
      type: isReply ? 'reply' : 'comment',
      direction,
      timestamp,
      description,
      details: value,
      author,
      permlink,
    };
  }

  private parseRewardActivity(type: string, value: any, timestamp: string, id: number): ActivityItem {
    const { author, permlink, hbd_payout, hive_payout, vesting_payout } = value;

    let activityType: ActivityType;
    let description = '';

    switch (type) {
      case 'author_reward':
        activityType = 'author_reward';
        description = `Received author reward for ${permlink}: ${hbd_payout} HBD, ${hive_payout} HIVE, ${vesting_payout} VESTS`;
        break;
      case 'curation_reward':
        activityType = 'curation_reward';
        description = `Received curation reward for ${permlink}: ${vesting_payout} VESTS`;
        break;
      case 'comment_benefactor_reward':
        activityType = 'benefactor_reward';
        description = `Received benefactor reward for ${permlink}: ${hbd_payout} HBD, ${hive_payout} HIVE, ${vesting_payout} VESTS`;
        break;
      default:
        activityType = 'other';
        description = `Received reward for ${permlink}`;
    }

    return {
      id,
      type: activityType,
      direction: 'in',
      timestamp,
      description,
      details: value,
      author,
      permlink,
      amount: `${hbd_payout} HBD, ${hive_payout} HIVE, ${vesting_payout} VESTS`,
    };
  }

  private parseTransferActivity(value: any, timestamp: string, id: number, username: string): ActivityItem {
    const { from, to, amount, memo } = value;
    const isIncoming = to === username;
    const direction = isIncoming ? 'in' : 'out';

    return {
      id,
      type: 'transfer',
      direction,
      timestamp,
      description: isIncoming
        ? `Received ${amount} from ${from}${memo ? ` (${memo})` : ''}`
        : `Sent ${amount} to ${to}${memo ? ` (${memo})` : ''}`,
      details: value,
      amount,
    };
  }

  private parseCustomJsonActivity(value: any, timestamp: string, id: number): ActivityItem | null {
    const { id: customId, json } = value;

    // Handle specific custom JSON operations
    if (customId === '3speak-publish') {
      try {
        const publishData = JSON.parse(json);
        return {
          id,
          type: 'other',
          direction: 'out',
          timestamp,
          description: `Published video "${publishData.title}"`,
          details: value,
          author: publishData.author,
          permlink: publishData.permlink,
        };
      } catch (e) {
        // Ignore parse errors
      }
    }

    return {
      id,
      type: 'other',
      direction: 'out',
      timestamp,
      description: `Custom operation: ${customId}`,
      details: value,
    };
  }

  private parseOtherActivity(type: string, value: any, timestamp: string, id: number): ActivityItem {
    return {
      id,
      type: 'other',
      direction: 'out',
      timestamp,
      description: `${type} operation`,
      details: value,
    };
  }

  formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  }
}

export const activityService = new ActivityService();
