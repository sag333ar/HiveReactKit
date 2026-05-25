/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommunityItem, CommunityDetailsResponse, CommunitySubscriber, CommunityActivity } from '../types/community';
import { Post } from '../types/post';
import { getHiveApiEndpoint } from '../config/hiveEndpoint';

class CommunityService {
  /** Always read the latest endpoint — `setHiveApiEndpoint()` may have been
   * called after construction, and a stale instance field would miss it. */
  private get HIVE_API_URL(): string { return getHiveApiEndpoint(); }

  async getListOfCommunities(
    query?: string,
    limit: number = 20,
    last?: string
  ): Promise<CommunityItem[]> {
    const params: any = { limit };
    
    if (last && last.trim() !== '') {
      params.last = last;
    }
    
    if (query && query.trim() !== '') {
      params.query = query;
    }

    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.list_communities',
      params,
      id: 1,
    };

    try {
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
      return data.result || [];
    } catch (error) {
      console.error('Error fetching communities:', error);
      throw error;
    }
  }

  async getCommunityDetails(communityId: string): Promise<CommunityDetailsResponse> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_community',
      params: { name: communityId },
      id: 1,
    };

    try {
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
    } catch (error) {
      console.error('Error fetching community details:', error);
      throw error;
    }
  }

  async getCommunitySubscribers(
    communityId: string,
    limit: number = 100,
    last?: string
  ): Promise<CommunitySubscriber[]> {
    const params: any = { community: communityId, limit };
    
    if (last && last.trim() !== '') {
      params.last = last;
    }

    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.list_community_roles',
      params,
      id: 1,
    };

    try {
      const response = await fetch(this.HIVE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return (data.result || []).map((item: any[]) => ({
        username: item[0],
        role: item[1],
        extra: item[2],
        subscribedAt: item[3],
      }));
    } catch (error) {
      console.error("Error fetching community subscribers:", error);
      throw error;
    }
  }

  async getCommunitySubscribersList(
    communityId: string,
    limit: number = 100,
    last?: string
  ): Promise<CommunitySubscriber[]> {
    const params: any = { community: communityId, limit };

    if (last && last.trim() !== "") {
      params.last = last;
    }

    const requestBody = {
      jsonrpc: "2.0",
      method: "bridge.list_subscribers",
      params,
      id: 2,
    };

    try {
      const response = await fetch(this.HIVE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return (data.result || []).map((item: any[]) => ({
        username: item[0],
        role: item[1],
        extra: item[2],
        subscribedAt: item[3],
      }));
    } catch (error) {
      console.error("Error fetching community subscribers list:", error);
      throw error;
    }
  }

  async getCommunityAccounts(communityId: string): Promise<any[]> {
    const requestBody = {
      jsonrpc: "2.0",
      method: "condenser_api.get_accounts",
      params: [[communityId]],
      id: 2,
    };

    try {
      const response = await fetch(this.HIVE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error("Error fetching community accounts:", error);
      throw error;
    }
  }

  async getRankedPosts(
    communityId: string,
    sort: string = "created",
    limit: number = 20,
    startAuthor?: string,
    startPermlink?: string
  ): Promise<any[]> {
    const params: any = {
      tag: communityId,
      sort,
      limit,
    };

    if (startAuthor && startPermlink) {
      params.start_author = startAuthor;
      params.start_permlink = startPermlink;
    }

    const requestBody = {
      jsonrpc: "2.0",
      method: "bridge.get_ranked_posts",
      params,
      id: 3,
    };

    try {
      const response = await fetch(this.HIVE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error("Error fetching ranked posts:", error);
      throw error;
    }
  }

  communityIcon(value: string): string {
    return `https://images.hive.blog/u/${value}/avatar?size=icon`;
  }


  /** Check whether `username` is subscribed to `communityId` using
   *  bridge.list_all_subscriptions. Returns false on network errors so
   *  the UI never blocks on a transient failure — the user can still
   *  press the button to (re)subscribe. */
  async isUserSubscribedToCommunity(username: string, communityId: string): Promise<boolean> {
    if (!username || !communityId) return false;
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.list_all_subscriptions',
      params: { account: username },
      id: 9,
    };
    try {
      const response = await fetch(this.HIVE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) return false;
      const data = await response.json();
      const list: any[] = data?.result || [];
      // Each entry is a tuple [community, title, role, label]
      return list.some(row => Array.isArray(row) && row[0] === communityId);
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  }

  userOwnerThumb(value: string): string {
    return `https://images.hive.blog/u/${value}/avatar`;
  }

  async getCommunityActivities(
    account: string,
    limit: number = 100,
    lastId?: number
  ): Promise<CommunityActivity[]> {
    const params: any = { account, limit };

    if (lastId) {
      params.last_id = lastId;
    }

    const requestBody = {
      jsonrpc: "2.0",
      method: "bridge.account_notifications",
      params,
      id: 19,
    };

    try {
      const response = await fetch(this.HIVE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error("Error fetching community activities:", error);
      throw error;
    }
  }

  /**
   * Snap references for a community, sourced from our `hreplier-api`
   * `/snaps/tags` endpoint. The query mirrors peakd.com's public
   * `/api/public/snaps/tags?container=…&tags=…` shape exactly, just
   * pointed at our backend. Returns the unsorted list of
   * `{ id, author, permlink }` references; full post data is
   * materialised by `getCommunitySnaps` via batched bridge.get_post.
   */
  async getCommunitySnapReferences(
    communityId: string,
    parent: string,
    signal?: AbortSignal,
  ): Promise<{ id: number; author: string; permlink: string }[]> {
    const url =
      `https://hreplier-api.sagarkothari88.one/snaps/tags` +
      `?container=${encodeURIComponent(parent)}` +
      `&tags=${encodeURIComponent(communityId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) throw new Error(`Snaps API error: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Community-scoped snaps for one container (`peak.snaps`,
   * `ecency.waves`, `leothreads`, `liketu.moments`). The hreplier-api
   * `/snaps?parent=&tag=` endpoint returns the full reference list in
   * one shot and has no server-side pagination, so we cache it per
   * (communityId, parent) and slice client-side. `startId` is the
   * 20-item page offset:
   *   - undefined / 0 → first 20 refs
   *   - 20, 40, …     → subsequent pages
   * `nextStartId` is the next offset to request, or null when
   * exhausted.
   *
   * Only the current slice is materialised via `bridge.get_post`, so
   * switching pages stays snappy.
   */
  async getCommunitySnaps(
    communityId: string,
    parent: string,
    startId?: number,
    observer?: string,
    signal?: AbortSignal,
  ): Promise<{ snaps: Post[]; nextStartId: number | null }> {
    const offset =
      typeof startId === 'number' && Number.isFinite(startId)
        ? Math.max(0, Math.floor(startId))
        : 0;

    const cacheKey = `${communityId}|${parent}`;
    let refs = communitySnapsRefsCache.get(cacheKey);
    if (!refs) {
      refs = await this.getCommunitySnapReferences(communityId, parent, signal);
      if (signal?.aborted) throw new Error('aborted');
      communitySnapsRefsCache.set(cacheKey, refs);
    }

    if (refs.length === 0 || offset >= refs.length) {
      return { snaps: [], nextStartId: null };
    }

    const slice = refs.slice(offset, offset + COMMUNITY_SNAPS_PAGE_SIZE);
    const snaps = await batchGetCommunitySnapPosts(slice, this.HIVE_API_URL, observer, signal);
    const nextOffset = offset + slice.length;
    const nextStartId = nextOffset < refs.length ? nextOffset : null;
    return { snaps, nextStartId };
  }
}

const COMMUNITY_SNAPS_PAGE_SIZE = 20;

/** Module-level cache so paginating doesn't re-fetch the full reference
 *  list every time. Keyed by `${communityId}|${parent}`. */
const communitySnapsRefsCache = new Map<
  string,
  { id: number; author: string; permlink: string }[]
>();

/** Batched bridge.get_post call mirroring `userService.batchGetPosts`. */
async function batchGetCommunitySnapPosts(
  refs: { author: string; permlink: string }[],
  hiveApiUrl: string,
  observer?: string,
  signal?: AbortSignal,
): Promise<Post[]> {
  const BATCH_SIZE = 5;
  const results: Post[] = [];
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = refs.slice(i, i + BATCH_SIZE);
    const rpcBatch = batch.map((ref, idx) => ({
      jsonrpc: '2.0',
      method: 'bridge.get_post',
      params: { author: ref.author, permlink: ref.permlink, observer: observer ?? '' },
      id: idx + 1,
    }));
    const response = await fetch(hiveApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcBatch),
      signal,
    });
    if (!response.ok) continue;
    const data = await response.json();
    const batchResults = Array.isArray(data) ? data : [data];
    for (const item of batchResults) {
      if (item?.result) results.push(item.result as Post);
    }
  }
  return results;
}

export const communityService = new CommunityService();

