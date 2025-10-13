/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "@hiveio/dhive";
import { 
  ActivityHistoryItem, 
  ActivityHistoryParams, 
  ActivityHistoryResponse,
  ActivityDisplayItem 
} from "@/types/activity";

// Initialize DHive client
const dhiveClient = new Client([
  "https://api.hive.blog",
  "https://api.syncad.com",
  "https://api.deathwing.me",
]);

class ActivityService {
  /**
   * Get activity history for a user (posts, comments, replies)
   * @param username - Hive username
   * @param sortBy - Sort by "posts", "comments", or "replies" (default: "posts")
   * @param limit - Maximum number of items to return (default: 20)
   * @param startAuthor - Starting author for pagination (optional)
   * @param startPermlink - Starting permlink for pagination (optional)
   * @param observer - Observer username for personalized results (optional)
   * @returns Promise<ActivityHistoryItem[]>
   */
  async getActivityHistory(
    username: string,
    sortBy: 'posts' | 'comments' | 'replies' = 'posts',
    limit: number = 20,
    startAuthor: string | null = null,
    startPermlink: string | null = null,
    observer: string | null = null
  ): Promise<ActivityHistoryItem[]> {
    const query: any = {
      account: username,
      sort: sortBy,
      limit: limit,
    };

    if (startAuthor) query.start_author = startAuthor;
    if (startPermlink) query.start_permlink = startPermlink;
    if (observer) query.observer = observer;

    try {
      const discussions = await dhiveClient.call(
        "bridge",
        "get_account_posts",
        query
      );
      
      // Return raw post/comment activity
      return Array.isArray(discussions) ? discussions : [];
    } catch (error) {
      console.error("Error in getActivityHistory:", error);
      return [];
    }
  }

  /**
   * Get user's posts only
   * @param username - Hive username
   * @param limit - Maximum number of posts to return
   * @returns Promise<ActivityHistoryItem[]>
   */
  async getUserPosts(username: string, limit: number = 20): Promise<ActivityHistoryItem[]> {
    return this.getActivityHistory(username, 'posts', limit);
  }

  /**
   * Get user's comments only
   * @param username - Hive username
   * @param limit - Maximum number of comments to return
   * @returns Promise<ActivityHistoryItem[]>
   */
  async getUserComments(username: string, limit: number = 20): Promise<ActivityHistoryItem[]> {
    return this.getActivityHistory(username, 'comments', limit);
  }

  /**
   * Get user's replies only
   * @param username - Hive username
   * @param limit - Maximum number of replies to return
   * @returns Promise<ActivityHistoryItem[]>
   */
  async getUserReplies(username: string, limit: number = 20): Promise<ActivityHistoryItem[]> {
    return this.getActivityHistory(username, 'replies', limit);
  }

  /**
   * Get all user activity (posts, comments, and replies combined)
   * @param username - Hive username
   * @param limit - Maximum number of items per type
   * @returns Promise<ActivityHistoryItem[]>
   */
  async getAllUserActivity(username: string, limit: number = 10): Promise<ActivityHistoryItem[]> {
    try {
      const [posts, comments, replies] = await Promise.all([
        this.getUserPosts(username, limit),
        this.getUserComments(username, limit),
        this.getUserReplies(username, limit)
      ]);

      // Combine all activities and sort by created date
      const allActivities = [...posts, ...comments, ...replies];
      return allActivities.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );
    } catch (error) {
      console.error("Error in getAllUserActivity:", error);
      return [];
    }
  }

  /**
   * Convert raw activity item to display format
   * @param item - Raw activity history item
   * @returns ActivityDisplayItem
   */
  convertToDisplayItem(item: ActivityHistoryItem): ActivityDisplayItem {
    return {
      id: item.id,
      author: item.author,
      permlink: item.permlink,
      title: item.title,
      body: item.body,
      created: item.created,
      category: item.category,
      net_votes: item.net_votes,
      children: item.children,
      total_payout_value: item.total_payout_value,
      pending_payout_value: item.pending_payout_value,
      url: item.url,
      type: item.parent_author === '' ? 'post' : 'comment'
    };
  }

  /**
   * Format activity timestamp to readable date
   * @param timestamp - Activity timestamp
   * @returns Formatted date string
   */
  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return timestamp;
    }
  }

  /**
   * Get relative time string (e.g., "2 hours ago")
   * @param timestamp - Activity timestamp
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

  /**
   * Truncate text to specified length
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @returns Truncated text
   */
  truncateText(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Get activity summary statistics
   * @param activities - Array of activities
   * @returns Summary statistics
   */
  getActivitySummary(activities: ActivityHistoryItem[]): {
    totalActivities: number;
    postsCount: number;
    commentsCount: number;
    totalVotes: number;
    totalPayout: string;
    averageVotes: number;
  } {
    let postsCount = 0;
    let commentsCount = 0;
    let totalVotes = 0;
    let totalPayoutValue = 0;

    activities.forEach(activity => {
      if (activity.parent_author === '') {
        postsCount++;
      } else {
        commentsCount++;
      }
      
      totalVotes += activity.net_votes || 0;
      
      // Parse payout value (format: "X.XXX HIVE" or "X.XXX HBD")
      const payoutMatch = activity.total_payout_value?.match(/(\d+\.?\d*)/);
      if (payoutMatch) {
        totalPayoutValue += parseFloat(payoutMatch[1]);
      }
    });

    return {
      totalActivities: activities.length,
      postsCount,
      commentsCount,
      totalVotes,
      totalPayout: `${totalPayoutValue.toFixed(3)} HIVE`,
      averageVotes: activities.length > 0 ? Math.round(totalVotes / activities.length) : 0
    };
  }

  /**
   * Filter activities by category
   * @param activities - Array of activities
   * @param category - Category to filter by
   * @returns Filtered activities
   */
  filterByCategory(activities: ActivityHistoryItem[], category: string): ActivityHistoryItem[] {
    return activities.filter(activity => activity.category === category);
  }

  /**
   * Filter activities by date range
   * @param activities - Array of activities
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Filtered activities
   */
  filterByDateRange(
    activities: ActivityHistoryItem[], 
    startDate: Date, 
    endDate: Date
  ): ActivityHistoryItem[] {
    return activities.filter(activity => {
      const activityDate = new Date(activity.created);
      return activityDate >= startDate && activityDate <= endDate;
    });
  }

  /**
   * Search activities by text
   * @param activities - Array of activities
   * @param searchText - Text to search for
   * @returns Filtered activities
   */
  searchActivities(activities: ActivityHistoryItem[], searchText: string): ActivityHistoryItem[] {
    const lowerSearchText = searchText.toLowerCase();
    return activities.filter(activity => 
      activity.title.toLowerCase().includes(lowerSearchText) ||
      activity.body.toLowerCase().includes(lowerSearchText) ||
      activity.category.toLowerCase().includes(lowerSearchText)
    );
  }
}

export const activityService = new ActivityService();
