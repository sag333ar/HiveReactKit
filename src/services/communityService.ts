/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommunityItem, CommunityDetailsResponse, CommunitySubscriber, CommunityActivity } from '../types/community';

class CommunityService {
  private readonly HIVE_API_URL = 'https://api.hive.blog';

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
}

export const communityService = new CommunityService();

