/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserProfileResponse {
  id: number;
  jsonrpc: string;
  result: {
    active: string;
    blacklists: any[];
    created: string;
    id: number;
    metadata: {
      profile: {
        about: string;
        blacklist_description: string;
        cover_image: string;
        location: string;
        muted_list_description: string;
        name: string;
        profile_image: string;
        website: string;
      };
    };
    name: string;
    post_count: number;
    reputation: number;
    stats: {
      followers: number;
      following: number;
      rank: number;
    };
  };
}

export interface Follower {
  follower: string;
  following: string;
  what: string[];
}

export interface Following {
  follower: string;
  following: string;
  what: string[];
}
