/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommunityItem, CommunityDetailsResponse, CommunitySubscriber } from '../types/community';

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
      return (data.result || []).map((item: any[]) => ({
        username: item[0],
        role: item[1],
        extra: item[2],
        subscribedAt: item[3],
      }));
    } catch (error) {
      console.error('Error fetching community subscribers:', error);
      throw error;
    }
  }

  communityIcon(value: string): string {
    return `https://images.hive.blog/u/${value}/avatar?size=icon`;
  }

  userOwnerThumb(value: string): string {
    return `https://images.hive.blog/u/${value}/avatar`;
  }
}

export const communityService = new CommunityService();