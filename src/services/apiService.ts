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
import { Client } from "@hiveio/dhive";

// Use dev proxy paths to avoid CORS in development. Vite proxy maps these to real RPC nodes.
const dhiveClient = new Client([
  "https://api.hive.blog",
  "https://api.syncad.com",
  "https://api.deathwing.me",
]);

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
  ): Promise<ThreeSpeakVideo> {
    const url = `${server.kThreeSpeakApiUrl}/video/@${username}/${permlink}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error("Failed to fetch video details:", response.statusText);
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
    return await this.fetchFeed(
      "UserChannelFeed",
      "socialFeed",
      "only: true",
      `{ byCreator: { _in: ["${username}"] } }`,
      { skip }
    );
  }

  async getHomeVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    // Keep using 3Speak API for home feed as requested
    const url = `${server.kThreeSpeakApiUrl}/feed/home?skip=${skip}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } else {
      console.error("Failed to fetch home videos:", response.statusText);
      return [];
    }
  }

  async getTrendingVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    return await this.fetchFeed(
      "TrendingFeed",
      "trendingFeed",
      "only: true",
      "{}",
      { skip }
    );
  }

  async getNewVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    return await this.fetchFeed(
      "NewUploadsFeed",
      "socialFeed",
      "only: true",
      "{}",
      { skip }
    );
  }

  async getFirstUploadsVideos(skip = 0): Promise<ThreeSpeakVideo[]> {
    return await this.fetchFeed(
      "FirstUploadsFeed",
      "trendingFeed",
      "only: true, firstUpload: true",
      "{}",
      { skip }
    );
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
    return await this.fetchFeed(
      "RelatedFeed",
      "socialFeed",
      "only: true",
      `{ byCreator: { _in: ["${username}"] } }`,
      { skip }
    );
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
    skip = 0,
    lang?: string
  ): Promise<ThreeSpeakVideo[]> {
    const feedOptions = lang ? `{ byLang: { _eq: "${lang}" } }` : `{}`;
    // Construct query manually here because searchFeed has a searchTerm argument
    const query = `
      query SearchFeed {
        searchFeed(
          searchTerm: "${term}"
          spkvideo: { only: true }
          feedOptions: ${feedOptions}
          pagination: { limit: 50, skip: ${skip} }
        ) {
          ${this.commonFields}
        }
      }
    `;
    const gqlItems = await this.getGQLFeed("SearchFeed", query);
    return this.convertGQLItemsToThreeSpeakVideos(gqlItems);
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
        numOfUpvotes: result?.net_votes ?? 0,
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

  async getCommentsList(
    author: string,
    permlink: string
  ): Promise<Discussion[]> {
    try {
      const rawResult: unknown = await dhiveClient.call(
        "bridge",
        "get_discussion",
        [author, permlink]
      );

      // The bridge API may return either an array of discussions or
      // an object keyed by "author/permlink" → Discussion.
      const list: Discussion[] = Array.isArray(rawResult)
        ? (rawResult as Discussion[])
        : rawResult && typeof rawResult === "object"
          ? Object.values(rawResult as Record<string, Discussion>)
          : [];

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
}

export const apiService = new ApiService();
export { server };
