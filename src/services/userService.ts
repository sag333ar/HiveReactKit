import { Follower, Following, UserProfileResponse, Account } from "@/types/user";
import { Post } from "@/types/post";
import type { Poll } from "@/types/poll";
import type { PendingAuthorRow, PendingCurationRow } from "@/types/reward";

class UserService {
  private readonly HIVE_API_URL = 'https://api.hive.blog';

  /** Central fetch wrapper — threads AbortSignal to every network request */
  private async _fetch(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    return fetch(url, signal ? { ...init, signal } : init);
  }

  async getProfile(username: string, signal?: AbortSignal): Promise<UserProfileResponse> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_profile',
      params: { account: username },
      id: 1,
    };

    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  async getFollowers(username: string, startFollower: string | null = null, limit = 100, signal?: AbortSignal): Promise<Follower[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_followers',
      params: [username, startFollower || '', 'blog', limit],
      id: 1,
    };

    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result;
  }

  async getFollowing(username: string, startFollowing: string | null = null, limit = 100, signal?: AbortSignal): Promise<Following[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_following',
      params: [username, startFollowing || '', 'blog', limit],
      id: 1,
    };

    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result;
  }

  async getAccounts(usernames: string[], signal?: AbortSignal): Promise<Account[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [usernames],
      id: 1,
    };

    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result;
  }

  async getDynamicGlobalProperties(signal?: AbortSignal): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_dynamic_global_properties',
      params: [],
      id: 1,
    };

    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

  async getFeedHistory(signal?: AbortSignal): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_feed_history',
      params: [],
      id: 1,
    };

    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

  async getUserBlogs(username: string, limit = 20, startAuthor?: string, startPermlink?: string, signal?: AbortSignal): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'blog', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  async getUserPosts(username: string, limit = 20, startAuthor?: string, startPermlink?: string, signal?: AbortSignal): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'posts', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  async getUserComments(username: string, limit = 20, startAuthor?: string, startPermlink?: string, signal?: AbortSignal): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'comments', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  async getUserReplies(username: string, limit = 20, startAuthor?: string, startPermlink?: string, signal?: AbortSignal): Promise<Post[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_account_posts',
      params: { sort: 'replies', account: username, observer: username, limit, start_author: startAuthor || null, start_permlink: startPermlink || null },
      id: 1,
    };
    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.result || [];
  }

  /**
   * Fetch snap references for a user from PeakD API.
   * Returns { id, author, permlink }[] with cursor for pagination.
   */
  async getSnapReferences(username: string, startId?: number, signal?: AbortSignal): Promise<{ id: number; author: string; permlink: string }[]> {
    let url = `https://peakd.com/api/public/snaps/account?container=peak.snaps&username=${username}`;
    if (startId !== undefined) {
      url += `&startId=${startId}`;
    }
    const response = await this._fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }, signal);
    if (!response.ok) throw new Error(`PeakD API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetch full post data for multiple snaps via batch bridge.get_post.
   * Fetches in batches of 5 to match PeakD's approach.
   */
  private async batchGetPosts(refs: { author: string; permlink: string }[], observer: string = '', signal?: AbortSignal): Promise<Post[]> {
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

      const response = await this._fetch(this.HIVE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcBatch),
      }, signal);
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
  async getUserSnaps(username: string, startId?: number, observer?: string, signal?: AbortSignal): Promise<{ snaps: Post[]; nextStartId: number | null }> {
    const refs = await this.getSnapReferences(username, startId, signal);
    if (refs.length === 0) {
      return { snaps: [], nextStartId: null };
    }

    const snaps = await this.batchGetPosts(refs, observer || username, signal);

    // Determine next cursor for pagination (last item's id)
    const lastRef = refs[refs.length - 1];
    const nextStartId = refs.length >= 15 ? lastRef.id : null; // PeakD returns ~15 per page

    return { snaps, nextStartId };
  }

  /**
   * Fetch polls created by a user from the HiveHub polls API.
   */
  async getUserPolls(username: string, signal?: AbortSignal): Promise<Poll[]> {
    const url = `https://polls.hivehub.dev/rpc/polls?author=eq.${encodeURIComponent(username)}&order=created.desc`;
    const response = await this._fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }, signal);
    if (!response.ok) throw new Error(`Polls API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Fetch full poll detail (includes poll_voters) by author and permlink.
   */
  async getPollDetail(author: string, permlink: string, signal?: AbortSignal): Promise<Poll | null> {
    const url = `https://polls.hivehub.dev/rpc/poll?author=eq.${encodeURIComponent(author)}&permlink=eq.${encodeURIComponent(permlink)}`;
    const response = await this._fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }, signal);
    if (!response.ok) throw new Error(`Polls API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private readonly API_THROTTLE_MS = 150; // 0.15s delay between API calls

  // ─── Reward Methods ─────────────────────────────────────────────────────

  private parseAssetFloat(asset: string | undefined | null): number {
    if (!asset) return 0;
    return parseFloat(asset.split(' ')[0]) || 0;
  }

  private parseHiveTime(val: string | undefined | null): number | null {
    if (!val) return null;
    const iso = val.endsWith('Z') ? val : `${val}Z`;
    const ms = Date.parse(iso);
    return isNaN(ms) ? null : ms;
  }

  /**
   * Fetch pending author rewards for a user.
   * Scans recent posts and comments with pending payouts.
   */
  async getPendingAuthorRewards(
    username: string,
    onBatch?: (rows: PendingAuthorRow[], totalHbd: number, totalHpEq: number) => void,
    signal?: AbortSignal
  ): Promise<{ rows: PendingAuthorRow[]; totalHbd: number; totalHpEq: number }> {
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const rows: PendingAuthorRow[] = [];
    const seen = new Set<string>();
    let totalHbd = 0;

    const collect = (p: any) => {
      if (!p || !p.author || !p.permlink) return;
      const key = `${p.author}/${p.permlink}`;
      if (seen.has(key)) return;
      const createdMs = this.parseHiveTime(p.created || p.posted);
      if (createdMs && createdMs < cutoffMs) return;
      const cashoutStr = p.cashout_time || p.payout_at || '';
      const cashout = this.parseHiveTime(cashoutStr);
      if (!cashout || isNaN(cashout) || cashout <= Date.now()) return;
      const maxPayout = this.parseAssetFloat(p.max_accepted_payout || '0');
      if (maxPayout === 0) return;
      const pending = this.parseAssetFloat(p.pending_payout_value || '0');
      if (p.is_paidout === true) return;
      const beneficiaries = Array.isArray(p.beneficiaries) ? p.beneficiaries : [];
      const beneCut = beneficiaries.reduce((acc: number, b: any) => acc + (Number(b.weight) || 0), 0) / 10000;
      const authorBase = pending * 0.5;
      const authorNet = authorBase * Math.max(0, Math.min(1, 1 - beneCut));
      seen.add(key);
      totalHbd += authorNet;
      rows.push({
        author: p.author,
        permlink: p.permlink,
        title: p.title || '',
        isComment: !!p.parent_author,
        payoutMs: cashout - Date.now(),
        hbd: authorNet,
        hpEq: null,
        beneficiaryCut: beneCut,
      });
    };

    const fetchBridge = async (sort: string) => {
      const limit = 20;
      const maxPages = 30;
      let start_author: string | null = null;
      let start_permlink: string | null = null;
      for (let page = 0; page < maxPages; page++) {
        const requestBody = {
          jsonrpc: '2.0',
          method: 'bridge.get_account_posts',
          params: { sort, account: username, observer: username, limit, start_author, start_permlink },
          id: 1,
        };
        const response = await this._fetch(this.HIVE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }, signal);
        if (!response.ok) break;
        const data = await response.json();
        const res = data.result;
        if (!Array.isArray(res) || !res.length) break;
        res.forEach(collect);
        const last = res[res.length - 1];
        const lastCreated = this.parseHiveTime(last?.created);
        start_author = last?.author || null;
        start_permlink = last?.permlink || null;
        if (res.length < limit || !start_author || !start_permlink) break;
        if (lastCreated && lastCreated < cutoffMs) break;
        await this.delay(this.API_THROTTLE_MS);
      }
    };

    await fetchBridge('posts');
    // Stream partial results after posts scan
    if (onBatch && rows.length > 0) {
      const sorted = [...rows].sort((a, b) => (a.payoutMs || 0) - (b.payoutMs || 0));
      onBatch(sorted, totalHbd, 0);
    }
    await fetchBridge('comments');

    rows.sort((a, b) => (a.payoutMs || 0) - (b.payoutMs || 0));

    // Convert HBD to HP equivalent using price feed
    let totalHpEq = 0;
    try {
      const priceFeed = await this.rpcCall('condenser_api.get_current_median_history_price', [], signal);
      const price = this.parseAssetFloat(priceFeed?.base) / this.parseAssetFloat(priceFeed?.quote || '1.000 HIVE');
      if (price > 0) {
        totalHpEq = totalHbd / price;
        rows.forEach(r => { r.hpEq = (r.hbd || 0) / price; });
      }
    } catch { /* price conversion optional */ }

    return { rows, totalHbd, totalHpEq };
  }

  /**
   * Fetch pending curation rewards for a user.
   * Scans vote history from last 10 days, then estimates curation per post.
   */
  async getPendingCurationRewards(
    username: string,
    onBatch?: (rows: PendingCurationRow[], totalHp: number, totalHbd: number) => void,
    signal?: AbortSignal
  ): Promise<{ rows: PendingCurationRow[]; totalHp: number; totalHbd: number }> {
    const LOOKBACK_DAYS = 10;
    const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    // Step 1: Fetch recent vote history
    const votes: any[] = [];
    const VOTE_FILTER_LOW = (1n << 0n).toString();
    let startIdx = -1;
    const limit = 1000;
    const seen = new Set<number>();

    for (let page = 0; page < 20; page++) {
      const params = [username, startIdx, limit, VOTE_FILTER_LOW, '0'];
      let chunk: any[];
      try {
        chunk = await this.rpcCall('condenser_api.get_account_history', params, signal);
      } catch {
        // Fallback: try without filter
        try {
          chunk = await this.rpcCall('condenser_api.get_account_history', [username, startIdx, limit], signal);
        } catch {
          break;
        }
      }
      if (!Array.isArray(chunk) || !chunk.length) break;

      let oldestTs = Infinity;
      for (const [seq, op] of chunk) {
        if (seen.has(seq)) continue;
        seen.add(seq);
        const [opName, opData] = op?.op || [];
        if (opName === 'vote' && opData?.voter === username) {
          votes.push({
            voter: opData.voter,
            author: opData.author,
            permlink: opData.permlink,
            weight: opData.weight,
            timestamp: op.timestamp,
          });
        }
        const ts = this.parseHiveTime(op?.timestamp);
        if (ts && ts < oldestTs) oldestTs = ts;
      }

      if (oldestTs <= cutoff) break;
      startIdx = chunk[0][0] - 1;
      if (startIdx < 0) break;
      await this.delay(this.API_THROTTLE_MS);
    }

    // Step 2: Deduplicate - keep latest vote per target
    const latestByTarget = new Map<string, any>();
    for (const v of votes) {
      const ts = this.parseHiveTime(v.timestamp);
      if (!ts || ts < cutoff) continue;
      const key = `${v.author}/${v.permlink}`;
      const prev = latestByTarget.get(key);
      if (!prev || (ts > (this.parseHiveTime(prev.timestamp) || 0))) {
        latestByTarget.set(key, v);
      }
    }

    const filtered = Array.from(latestByTarget.values())
      .filter(v => (v.weight || 0) > 0);

    if (!filtered.length) return { rows: [], totalHp: 0, totalHbd: 0 };

    // Step 3: Fetch blockchain context
    const [rewardFund, priceFeed, dgp] = await Promise.all([
      this.rpcCall('condenser_api.get_reward_fund', ['post'], signal),
      this.rpcCall('condenser_api.get_current_median_history_price', [], signal),
      this.getDynamicGlobalProperties(signal),
    ]);

    const hivePrice = this.parseAssetFloat(priceFeed?.base) / this.parseAssetFloat(priceFeed?.quote || '1.000 HIVE');
    const curationBps = Number(rewardFund?.percent_curation_rewards || 5000);

    // Step 4: Estimate curation for each vote (batch of 6)
    const results: PendingCurationRow[] = [];
    const batchSize = 6;

    for (let i = 0; i < filtered.length; i += batchSize) {
      const batch = filtered.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (vote) => {
        try {
          const content = await this.rpcCall('condenser_api.get_content', [vote.author, vote.permlink], signal);
          if (!content) return null;
          if (content.allow_curation_rewards === false) return null;

          const cashout = this.parseHiveTime(content.cashout_time);
          if (!cashout || cashout <= Date.now()) return null;

          const maxPayout = this.parseAssetFloat(content.max_accepted_payout);
          if (maxPayout <= 0) return null;

          const pending = this.parseAssetFloat(content.pending_payout_value || '0');
          if (pending <= 0) return null;

          // Get active votes
          let activeVotes = Array.isArray(content.active_votes) && content.active_votes.length
            ? content.active_votes
            : await this.rpcCall('condenser_api.get_active_votes', [vote.author, vote.permlink], signal);

          if (!Array.isArray(activeVotes) || !activeVotes.length) return null;

          const curatorVote = activeVotes.find((v: any) => v.voter === username);
          if (!curatorVote) return null;

          const curatorRshares = Number(curatorVote.rshares || 0);
          if (curatorRshares <= 0) return null;

          // Calculate curation pool and curator's share
          const curationPool = pending * (curationBps / 10000);

          // Use vote_weight if available (more accurate), else use rshares proportion
          let curatorShare: number;
          const voteWeight = Number(curatorVote.weight || 0);
          const totalVoteWeight = Number(content.total_vote_weight || 0);
          if (voteWeight > 0 && totalVoteWeight > 0) {
            curatorShare = voteWeight / totalVoteWeight;
          } else {
            const totalPositiveRshares = activeVotes.reduce((sum: number, v: any) => {
              const rs = Number(v.rshares || 0);
              return rs > 0 ? sum + rs : sum;
            }, 0);
            curatorShare = totalPositiveRshares > 0 ? curatorRshares / totalPositiveRshares : 0;
          }

          const estimatedHbd = curationPool * curatorShare;
          const estimatedHp = hivePrice > 0 ? estimatedHbd / hivePrice : 0;

          if (estimatedHp <= 0) return null;

          // Calculate efficiency
          const totalPositiveRshares = activeVotes.reduce((sum: number, v: any) => {
            const rs = Number(v.rshares || 0);
            return rs > 0 ? sum + rs : sum;
          }, 0);
          const rsharesShare = totalPositiveRshares > 0 ? curatorRshares / totalPositiveRshares : 0;
          const efficiency = rsharesShare > 0 ? (curatorShare / rsharesShare) * 100 : null;

          // Time calculations
          const createdMs = this.parseHiveTime(content.created);
          const voteTimeMs = curatorVote.time ? this.parseHiveTime(curatorVote.time) : this.parseHiveTime(vote.timestamp);
          const votedAfterMs = createdMs && voteTimeMs ? Math.max(0, voteTimeMs - createdMs) : null;

          let votePercent = Number(vote.weight || 0);
          if (curatorVote.percent !== undefined) votePercent = Number(curatorVote.percent);

          return {
            hp: estimatedHp,
            hbd: estimatedHbd,
            author: vote.author,
            permlink: vote.permlink,
            title: content.title || `${vote.author}/${vote.permlink}`,
            payoutMs: cashout - Date.now(),
            votedAfterMs,
            weightPct: (votePercent || 0) / 100,
            efficiency,
            isComment: !!content.parent_author,
          } as PendingCurationRow;
        } catch {
          return null;
        }
      }));

      for (const r of batchResults) {
        if (r && r.hp > 0) results.push(r);
      }

      // Stream partial results to UI after each batch
      if (onBatch && results.length > 0) {
        const sorted = [...results].sort((a, b) => (a.payoutMs || 0) - (b.payoutMs || 0));
        const hp = sorted.reduce((acc, r) => acc + (r.hp || 0), 0);
        const hbd = sorted.reduce((acc, r) => acc + (r.hbd || 0), 0);
        onBatch(sorted, hp, hbd);
      }

      // Throttle between batches to avoid rate limiting
      if (i + batchSize < filtered.length) {
        await this.delay(this.API_THROTTLE_MS);
      }
    }

    results.sort((a, b) => (a.payoutMs || 0) - (b.payoutMs || 0));
    const totalHp = results.reduce((acc, r) => acc + (r.hp || 0), 0);
    const totalHbd = results.reduce((acc, r) => acc + (r.hbd || 0), 0);

    return { rows: results, totalHp, totalHbd };
  }

  /** Generic RPC call helper */
  private async rpcCall(method: string, params: any, signal?: AbortSignal): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    };
    const response = await this._fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, signal);
    if (!response.ok) throw new Error(`RPC error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'RPC error');
    return data.result;
  }

  userAvatar(username: string): string {
    return `https://images.hive.blog/u/${username}/avatar`;
  }
}

export const userService = new UserService();
