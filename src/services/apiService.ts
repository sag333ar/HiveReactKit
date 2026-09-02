/* eslint-disable @typescript-eslint/no-explicit-any */
import { ThreeSpeakVideo, LoginModel, ActiveVote } from "@/types/video";
import { TrendingTag } from "@/types/trending";
import { Discussion } from "@/types/comment";
import { GQLVideoItem } from "@/types/graphql";
import { Post, PostSort } from "@/types/post";
const server = {
  domain: "https://studio.3speak.tv",
  kThreeSpeakApiUrl: "https://studio.3speak.tv/mobile/api",
  userOwnerThumb: (username: string) =>
    `https://images.hive.blog/u/${username}/avatar`,
  graphQLServerUrl: "https://union.us-02.infra.3speak.tv",
};
import { getHiveClient } from "../config/hiveEndpoint";

// Shared dhive client — its address is updated at runtime via
// setHiveApiEndpoint(), so every call here uses the user-selected node.
const dhiveClient = getHiveClient();

class ApiService {
  // Common data fields fragment (for reuse)
  private readonly commonFields = `
    items {
      created_at
      title
      permlink
      author {
        username
      }
      json_metadata {
        raw
      }
      stats {
        active_voters {
          percent
          rshares
          voter
          weight
        }
        num_comments
        num_votes
        total_hive_reward
      }
      ... on HivePost {
        lang
        tags
        spkvideo
      }
    }
  `;

  // Generic GraphQL feed fetcher
  private async getGQLFeed(
    operationName: string,
    query: string
  ): Promise<GQLVideoItem[]> {
    const gqlServer = `${server.graphQLServerUrl}/api/v2/graphql`;

    try {
      const response = await fetch(gqlServer, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          operationName: operationName,
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        throw new Error(
          `GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`
        );
      }

      const data = json.data;
      if (data.socialFeed?.items) return data.socialFeed.items;
      if (data.trendingFeed?.items) return data.trendingFeed.items;
      if (data.searchFeed?.items) return data.searchFeed.items;

      return [];
    } catch (error) {
      console.error(`Failed to fetch ${operationName}:`, error);
      throw error;
    }
  }

  async handleLogin(result: LoginModel): Promise<Record<string, any>> {
    const url = `${server.domain}/mobile/login`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge: result.challenge,
        proof: result.proof,
        publicKey: result.publicKey,
        username: result.username,
      }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`Login API error: ${await response.text()}`);
    }
  }

  async handleUpvote({
    author,
    permlink,
    weight,
    authToken,
  }: {
    author: string;
    permlink: string;
    weight: number;
    authToken: string;
  }): Promise<Record<string, any>> {
    const url = `${server.domain}/mobile/vote`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: authToken,
      },
      body: JSON.stringify({
        author,
        permlink,
        weight,
      }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || "Unknown API error");
    }
  }

  async handleComment({
    author,
    permlink,
    body,
    authToken,
  }: {
    author: string;
    permlink: string;
    body: string;
    authToken: string;
  }): Promise<Record<string, any>> {
    const url = `${server.domain}/mobile/comment`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: authToken,
      },
      body: JSON.stringify({
        author,
        permlink,
        comment: body,
      }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || "Unknown API error");
    }
  }

  async getVideoDetails(
    username: string,
    permlink: string
  ): Promise<ThreeSpeakVideo | null> {
    const cleanUser = username.toLowerCase().replace(/^@/, '');
    const url = `https://checker.3speak.tv/videodetails/${cleanUser}/${permlink}`;
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title || 'Untitled',
          owner: data.owner || data.author || cleanUser,
          permlink: data.permlink || permlink,
          created: data.created_at ? new Date(data.created_at) : new Date(),
          category: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags[0] : 'general',
          duration: data.duration || data.spkvideo?.duration || 0,
          thumbnail: data.thumbnail_url || data.images?.thumbnail || data.images?.poster || '',
          video_v2: data.spkvideo?.video_v2 || data.manifest_cid || '',
          numOfUpvotes: data.stats?.num_votes ?? 0,
          numOfComments: data.stats?.num_comments ?? 0,
          hiveValue: data.stats?.total_hive_reward ?? 0,
          active_votes: [],
        } as ThreeSpeakVideo;
      }
      return null;
    } catch (e) {
      console.error("Failed to fetch video details:", e);
      return null;
    }
  }

  private async fetchCheckerFeed(url: string): Promise<ThreeSpeakVideo[]> {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const json = await res.json();
      const list = Array.isArray(json?.videos) ? json.videos : (Array.isArray(json?.results) ? json.results : []);
      return list.map((item: any) => ({
        title: item.title || 'Untitled',
        owner: item.owner || item.author || '',
        permlink: item.permlink || '',
        created: item.created_at ? new Date(item.created_at) : (item.created ? new Date(item.created) : new Date()),
        category: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags[0] : 'general',
        duration: item.duration || item.spkvideo?.duration || 0,
        thumbnail: item.images?.thumbnail || item.images?.poster || item.thumbnail_url || '',
        video_v2: item.spkvideo?.video_v2 || '',
        numOfUpvotes: item.stats?.num_votes ?? 0,
        numOfComments: item.stats?.num_comments ?? 0,
        hiveValue: item.stats?.total_hive_reward ?? 0,
        active_votes: [],
      } as ThreeSpeakVideo));
    } catch (e) {
      console.error("Failed to fetch checker feed:", e);
      return [];
    }
  }

  // Common feed fetching method to reduce code duplication
  private async fetchFeed(
    operationName: string,
    feedFieldName: string,
    spkvideoOptions: string,
    feedOptions: string,
    pagination: { limit?: number; skip?: number } = { limit: 50, skip: 0 }
  ): Promise<ThreeSpeakVideo[]> {
    const { limit = 50, skip = 0 } = pagination;
    const query = `
      query ${operationName} {
        ${feedFieldName}(
          spkvideo: { ${spkvideoOptions} }
          feedOptions: ${feedOptions}
          pagination: { limit: ${limit}, skip: ${skip} }
        ) {
          ${this.commonFields}
        }
      }
    `;

    const gqlItems = await this.getGQLFeed(operationName, query);
    return this.convertGQLItemsToThreeSpeakVideos(gqlItems);
  }

  async getUserVideos(username: string, skip = 0): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/feed/${username.toLowerCase().replace(/^@/, '')}?page=${page}&limit=20`);
  }

  async getHomeVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/feeds/trendingSorted?page=${page}&limit=20`);
  }

  async getTrendingVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/feeds/trendingSorted?page=${page}&limit=20`);
  }

  async getNewVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/feeds/new?page=${page}&limit=20`);
  }

  async getFirstUploadsVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/feeds/firstUploads?page=${page}&limit=20`);
  }

  async getCommunityVideos(
    community: string,
    skip = 0
  ): Promise<ThreeSpeakVideo[]> {
    return await this.fetchFeed(
      "CommunityFeed",
      "socialFeed",
      "only: true",
      `{ byCommunity: { _eq: "${community}" } }`,
      { skip }
    );
  }

  async getRelatedVideos(username: string, skip = 0): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/feed/${username.toLowerCase().replace(/^@/, '')}?page=${page}&limit=20`);
  }

  async getTaggedVideos(tag: string, skip = 0): Promise<ThreeSpeakVideo[]> {
    return await this.fetchFeed(
      "TrendingTagFeed",
      "trendingFeed",
      "only: true",
      `{ byTag: { _eq: "${tag}" } }`,
      { skip }
    );
  }

  async getSearchFeed(
    term: string,
    skip = 0
  ): Promise<ThreeSpeakVideo[]> {
    const page = Math.floor(skip / 20) + 1;
    return await this.fetchCheckerFeed(`https://checker.3speak.tv/search?q=${encodeURIComponent(term)}&page=${page}&limit=20`);
  }

  async getTrendingTags(): Promise<TrendingTag[]> {
    const gqlServer = `${server.graphQLServerUrl}/api/v2/graphql`;
    const query = `
      query TrendingTags {
        trendingTags(limit: 50) {
          tags {
            score
            tag
          }
        }
      }
    `;

    try {
      const response = await fetch(gqlServer, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          operationName: "TrendingTags",
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        throw new Error(
          `GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`
        );
      }

      return json.data?.trendingTags?.tags || [];
    } catch (error) {
      console.error("Failed to fetch trending tags:", error);
      throw error;
    }
  }
  // Convert GQL items to ThreeSpeakVideo format
  private convertGQLItemsToThreeSpeakVideos(
    gqlItems: GQLVideoItem[]
  ): ThreeSpeakVideo[] {
    return gqlItems.map((item) => {
      let spkvideoData = null;
      try {
        if (typeof item.spkvideo === "string") {
          spkvideoData = JSON.parse(item.spkvideo);
        } else {
          spkvideoData = item.spkvideo;
        }
      } catch (e) {
        console.error("Error parsing spkvideo JSON", e);
      }

      return {
        title: item.title || "Untitled",
        owner: item.author?.username || "",
        permlink: item.permlink || "",
        created: new Date(item.created_at),
        category: item.tags && item.tags.length > 0 ? item.tags[0] : "general",
        duration:
          spkvideoData?.duration ||
          item.json_metadata?.raw?.video?.info?.duration ||
          0,
        thumbnail:
          spkvideoData?.thumbnail_url ||
          item.json_metadata?.raw?.video?.info?.thumbnail,
        // Include stats from GraphQL response
        numOfUpvotes: item.stats?.num_votes,
        numOfComments: item.stats?.num_comments,
        hiveValue: item.stats?.total_hive_reward,
        // Store active_voters for later use
        active_votes:
          item.stats?.active_voters?.map((voter) => ({
            voter: voter.voter,
            percent: voter.percent,
            rshares: voter.rshares,
            weight: voter.weight,
          })) || [],
      } as ThreeSpeakVideo;
    });
  }

  async getContentStats(author: string, permlink: string) {
    try {
      const result: any = await dhiveClient.call(
        "condenser_api",
        "get_content",
        [author, permlink]
      );
      return {
        numOfUpvotes: result?.active_votes?.length ?? Math.max(0, result?.net_votes ?? 0),
        numOfComments: result?.children ?? 0,
        hiveValue: result?.pending_payout_value
          ? parseFloat(result.pending_payout_value)
          : 0,
      };
    } catch (error) {
      return {
        numOfUpvotes: 0,
        numOfComments: 0,
        hiveValue: 0,
      };
    }
  }

  async getActiveVotes(
    author: string,
    permlink: string
  ): Promise<ActiveVote[]> {
    try {
      const result = await dhiveClient.call(
        "condenser_api",
        "get_active_votes",
        [author, permlink]
      );
      return result as ActiveVote[];
    } catch (error) {
      console.error("Error calling get_active_votes:", error);
      return [];
    }
  }

  async listVotes(
    author: string,
    permlink: string,
    startVoter: string = "",
    limit: number = 1000
  ): Promise<any[]> {
    try {
      const result: any = await dhiveClient.call(
        "database_api",
        "list_votes",
        {
          start: [author, permlink, startVoter],
          limit: limit,
          order: "by_comment_voter",
        }
      );
      if (result && Array.isArray(result.votes)) {
        return result.votes.filter(
          (v: any) => v.author === author && v.permlink === permlink
        );
      }
      return [];
    } catch (error) {
      console.error("Error calling list_votes:", error);
      return [];
    }
  }

  async getAccounts(usernames: string[]): Promise<any[]> {
    try {
      if (usernames.length === 0) return [];
      return await dhiveClient.database.getAccounts(usernames);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      return [];
    }
  }

  // `observer` is accepted for call-site symmetry with get_post/
  // get_account_posts/get_ranked_posts, but bridge.get_discussion doesn't
  // take one — it's intentionally not forwarded into the RPC params.
  async getCommentsList(
    author: string,
    permlink: string,
    observer: string = ''
  ): Promise<Discussion[]> {
    void observer;
    try {
      const rawResult: unknown = await dhiveClient.call(
        "bridge",
        "get_discussion",
        { author, permlink }
      );

      // The bridge API may return either an array of discussions or
      // an object keyed by "author/permlink" → Discussion.
      let list: Discussion[] = Array.isArray(rawResult)
        ? (rawResult as Discussion[])
        : rawResult && typeof rawResult === "object"
          ? Object.values(rawResult as Record<string, Discussion>)
          : [];

      // Exclude the root post (supplied author/permlink) so only comments/replies are returned
      list = list.filter(
        (c) => !(c.author === author && c.permlink === permlink)
      );

      return list.map((comment) => {
        // Normalize depth as number and ensure required fields exist
        const rawDepth: unknown = (
          comment as unknown as Record<string, unknown>
        ).depth;
        if (typeof rawDepth === "string") {
          const parsed = parseInt(rawDepth, 10);
          comment.depth = Number.isFinite(parsed) ? parsed : 0;
        } else if (typeof rawDepth !== "number" || !Number.isFinite(rawDepth)) {
          comment.depth = comment.depth ?? 0;
        }

        // Safely parse json_metadata only when it's a JSON string.
        // If it's already an object, use it directly. Ignore invalid cases.
        const jm: unknown = (comment as unknown as Record<string, unknown>)
          .json_metadata as unknown;
        try {
          if (jm && typeof jm === "string") {
            const trimmed = jm.trim();
            if (
              (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
              (trimmed.startsWith("[") && trimmed.endsWith("]"))
            ) {
              comment.json_metadata_parsed = JSON.parse(trimmed);
            }
          } else if (jm && typeof jm === "object") {
            // Already parsed object
            comment.json_metadata_parsed = jm as Record<string, unknown>;
          }
        } catch (e) {
          // Log once per comment succinctly; server returns sometimes non-JSON like "[object Object]"
          console.warn(
            `Skipped invalid json_metadata for ${comment.author}/${comment.permlink}`
          );
        }
        return comment;
      });
    } catch (error) {
      console.error("Error fetching comments list:", error);
      return [];
    }
  }

  async getMyVideos(authToken: string): Promise<ThreeSpeakVideo[]> {
    const url = `${server.domain}/mobile/api/my-videos`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error("Failed to fetch my videos:", response.statusText);
      throw new Error(`Failed to fetch my videos: ${response.status}`);
    }
  }

  async getRankedPosts(sort: PostSort = 'trending', tag = '', observer = 'hive.blog', limit = 20, start_author?: string, start_permlink?: string): Promise<Post[]> {
    try {
      const params: any = {
        sort,
        tag,
        observer,
        limit,
      };
      if (start_author && start_permlink) {
        params.start_author = start_author;
        params.start_permlink = start_permlink;
      }
      const result: any = await dhiveClient.call('bridge', 'get_ranked_posts', params);
      return result as Post[];
    } catch (error) {
      console.error('Error fetching ranked posts:', error);
      return [];
    }
  }

  async getPostContent(
    author: string,
    permlink: string,
    observer: string = ''
  ): Promise<Post | null> {
    try {
      // Prefer `bridge.get_post` when an observer is supplied so the
      // chain can return observer-aware fields (e.g. `stats.gray` /
      // `stats.hide` driven by the observer's mute list) and so the
      // payload shape matches what `bridge.get_discussion` returns
      // for the comment thread below. Falls back to the universal
      // `condenser_api.get_content` for anonymous reads.
      if (observer) {
        const bridgeResult: any = await dhiveClient.call(
          'bridge',
          'get_post',
          { author, permlink, observer },
        );
        if (bridgeResult) return bridgeResult as Post;
      }
      const result: any = await dhiveClient.call(
        "condenser_api",
        "get_content",
        [author, permlink]
      );
      return result as Post;
    } catch (error) {
      console.error('Error fetching post content:', error);
      return null;
    }
  }
}

export const apiService = new ApiService();
export { server };
