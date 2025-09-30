/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CommunityItem {
  id?: number;
  name?: string;
  title?: string;
  about?: string;
  description?: string;
  type_id?: number;
  is_nsfw?: boolean;
  subscribers?: number;
  sum_pending?: number;
  num_authors?: number;
  num_pending?: number;
  team?: string[][];
  avatar_url?: string;
  lang?: string;
  created_at?: string;
  context?: Record<string, any>;
  rank?: number;
  score?: number;
  flag_text?: string;
}

export interface CommunityDetailsResponse {
  jsonrpc: string;
  result: CommunityDetailsResult;
  id: number;
}

export interface CommunityDetailsResult {
  id: number;
  name: string;
  title: string;
  about: string;
  lang: string;
  type_id: number;
  is_nsfw: boolean;
  subscribers: number;
  created_at: string;
  sum_pending: number;
  num_pending: number;
  num_authors: number;
  avatar_url: string;
  description: string;
  flag_text: string;
  team: string[][];
  context: Record<string, any>;
  settings?: Record<string, any>;
}
export interface CommunitySubscriber {
  username: string;
  role: string;
  extra?: string;
  subscribedAt: string;
}

export interface CommunitiesRequestParams {
  limit?: number;
  query?: string;
  last?: string;
}