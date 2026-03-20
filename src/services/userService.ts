import { Follower, Following, UserProfileResponse, Account } from "@/types/user";
import { Post } from "@/types/post";
import type { Poll } from "@/types/poll";

class UserService {
  private readonly HIVE_API_URL = 'https://api.hive.blog';

  async getProfile(username: string): Promise<UserProfileResponse> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_profile',
      params: {
        account: username,
      },
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
    return data;
  }

  async getFollowers(username: string, startFollower: string | null = null, limit = 100): Promise<Follower[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_followers',
      params: [username, startFollower || '', 'blog', limit],
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
    return data.result;
  }

  async getFollowing(username: string, startFollowing: string | null = null, limit = 100): Promise<Following[]> {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'condenser_api.get_following',
        params: [username, startFollowing || '', 'blog', limit],
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
    return data.result;
  }

  async getAccounts(usernames: string[]): Promise<Account[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [usernames],
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
    return data.result;
  }

  async getDynamicGlobalProperties(): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_dynamic_global_properties',
      params: [],
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
    return data.result;
  }

  async convertVestingSharesToHive(vestingShares: string): Promise<string> {
    try {
      const props = await this.getDynamicGlobalProperties();
      const vestingSharesFloat = parseFloat(vestingShares.split(' ')[0]);
      const totalVestingShares = parseFloat(
        props.total_vesting_shares.split(' ')[0]
      );
      const totalVestingFundHive = parseFloat(
        props.total_vesting_fund_hive.split(' ')[0]
      );
      const hiveValue = (
        (vestingSharesFloat * totalVestingFundHive) /
        totalVestingShares
      ).toFixed(3);
      return hiveValue;
    } catch (error) {
      console.error('Error converting vesting shares:', error);
      return '0';
    }
  }

  async getFeedHistory(): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_feed_history',
      params: [],
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
    return data.result;
  }

  async getVoteValue(username: string, weight: number = 10000): Promise<string> {
    try {
      const accounts = await this.getAccounts([username]);
      if (accounts.length === 0) {
        throw new Error('Account not found!');
      }
      const account = accounts[0];

      // Get dynamic global properties for vote calculation
      const props = await this.getDynamicGlobalProperties();
      const feedHistory = await this.getFeedHistory();

      // Calculate vote value using the standard Hive vote value formula
      const totalShares =
        parseFloat(account.vesting_shares) +
        parseFloat(account.received_vesting_shares) -
        parseFloat(account.delegated_vesting_shares) -
        parseFloat(account.vesting_withdraw_rate);

      const elapsed = Math.floor(Date.now() / 1000) - account.voting_manabar.last_update_time;
      const maxMana = (totalShares * 1000000) / 4;

      let currentMana =
        parseFloat(account.voting_manabar.current_mana.toString()) +
        (elapsed * maxMana) / (5 * 60 * 60 * 24);

      if (currentMana > maxMana) {
        currentMana = maxMana;
      }

      const currentVotingPower = (currentMana * 100) / maxMana;

      // Calculate rshares (reward shares)
      const vestingSharesStr = account.vesting_shares || '0 VESTS';
      const vestingShares = parseFloat(vestingSharesStr.toString().split(' ')[0]);
      const totalVestingSharesStr = props.total_vesting_shares || '0 VESTS';
      const totalVestingShares = parseFloat(totalVestingSharesStr.toString().split(' ')[0]);
      const votePercent = weight / 10000; // weight is in basis points (10000 = 100%)
      const usedPower = (currentVotingPower * votePercent) / 100;
      const maxVoteDenom = props.vote_power_reserve_rate * (5 * 60 * 60 * 24) / (60 * 60 * 24);
      const usedMana = (usedPower * maxMana) / 100;

      // Simplified vote value calculation
      const recentClaims = parseFloat(props.recent_claims || '0');
      const rewardBalanceStr = props.reward_balance || '0 HIVE';
      const rewardBalance = parseFloat(rewardBalanceStr.toString().split(' ')[0]);
      const currentSupplyStr = props.current_supply || '0 HIVE';
      const currentSupply = parseFloat(currentSupplyStr.toString().split(' ')[0]);
      const currentSbdSupplyStr = props.current_sbd_supply || '0 HBD';
      const currentSbdSupply = parseFloat(currentSbdSupplyStr.toString().split(' ')[0]);

      const voteValue = (rewardBalance / recentClaims) * (vestingShares / totalVestingShares) * (usedMana / maxMana) * currentSupply;

      // Convert to USD using feed price
      const currentMedian = feedHistory?.current_median_history;
      if (!currentMedian || !currentMedian.base) {
        return '0.00';
      }
      const baseAmount = parseFloat(currentMedian.base.toString().split(' ')[0]);
      const usdValue = voteValue * baseAmount;

      return usdValue.toFixed(2);
    } catch (error) {
      console.error('Error calculating vote value:', error);
      return '0.00';
    }
  }

  async getUserBlogs(username: string, limit = 20, startAuthor?: string, startPermlink?: string): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'blog', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  async getUserPosts(username: string, limit = 20, startAuthor?: string, startPermlink?: string): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'posts', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  async getUserComments(username: string, limit = 20, startAuthor?: string, startPermlink?: string): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'comments', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  async getUserReplies(username: string, limit = 20, startAuthor?: string, startPermlink?: string): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'replies', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  /**
   * Fetch snap references for a user from PeakD API.
   * Returns { id, author, permlink }[] with cursor for pagination.
   */
  async getSnapReferences(username: string, startId?: number): Promise<{ id: number; author: string; permlink: string }[]> {
    // Use Vite proxy in dev (/api/peakd → https://peakd.com/api/public) to avoid CORS
    // In production, use the direct URL
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const baseUrl = isDev ? '/api/peakd' : 'https://peakd.com/api/public';
    let url = `${baseUrl}/snaps/account?container=peak.snaps&username=${username}`;
    if (startId !== undefined) {
      url += `&startId=${startId}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`PeakD API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetch full post data for multiple snaps via batch bridge.get_post.
   * Fetches in batches of 5 to match PeakD's approach.
   */
  private async batchGetPosts(refs: { author: string; permlink: string }[], observer: string = ''): Promise<Post[]> {
    const BATCH_SIZE = 5;
    const results: Post[] = [];

    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = refs.slice(i, i + BATCH_SIZE);
      const rpcBatch = batch.map((ref, idx) => ({
        jsonrpc: '2.0',
        method: 'bridge.get_post',
        params: { author: ref.author, permlink: ref.permlink, observer },
        id: idx + 1,
      }));

      const response = await fetch(this.HIVE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcBatch),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const batchResults = Array.isArray(data) ? data : [data];
      for (const item of batchResults) {
        if (item?.result) {
          results.push(item.result as Post);
        }
      }
    }

    return results;
  }

  /**
   * Fetch snaps for a user using PeakD API + Hive bridge.get_post.
   * Step 1: Get snap references from PeakD (with pagination via startId)
   * Step 2: Batch fetch full post data via bridge.get_post
   */
  async getUserSnaps(username: string, startId?: number, observer?: string): Promise<{ snaps: Post[]; nextStartId: number | null }> {
    // Step 1: Get snap references
    const refs = await this.getSnapReferences(username, startId);
    if (refs.length === 0) {
      return { snaps: [], nextStartId: null };
    }

    // Step 2: Batch fetch full post data
    const snaps = await this.batchGetPosts(refs, observer || username);

    // Determine next cursor for pagination (last item's id)
    const lastRef = refs[refs.length - 1];
    const nextStartId = refs.length >= 15 ? lastRef.id : null; // PeakD returns ~15 per page

    return { snaps, nextStartId };
  }

  /**
   * Fetch polls created by a user from the HiveHub polls API.
   */
  async getUserPolls(username: string): Promise<Poll[]> {
    const url = `https://polls.hivehub.dev/rpc/polls?author=eq.${encodeURIComponent(username)}&order=created.desc`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`Polls API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetch full poll detail (includes poll_voters) by author and permlink.
   */
  async getPollDetail(author: string, permlink: string): Promise<Poll | null> {
    const url = `https://polls.hivehub.dev/rpc/poll?author=eq.${encodeURIComponent(author)}&permlink=eq.${encodeURIComponent(permlink)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`Polls API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  userAvatar(username: string): string {
    return `https://images.hive.blog/u/${username}/avatar`;
  }
}

export const userService = new UserService();
