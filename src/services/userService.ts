import { Follower, Following, UserProfileResponse } from "@/types/user";

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

  async getFollowers(username: string): Promise<Follower[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_followers',
      params: [username, null, 'blog'],
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

  async getFollowing(username: string): Promise<Following[]> {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'condenser_api.get_following',
        params: [username, null, 'blog'],
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

  userAvatar(username: string): string {
    return `https://images.hive.blog/u/${username}/avatar`;
  }
}

export const userService = new UserService();
