/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActiveVote } from './video';

export interface Beneficiary {
  account: string;
  weight: number;
}

export interface PostStats {
  flag_weight: number;
  gray: boolean;
  hide: boolean;
  total_votes: number;
}

export interface Post {
  active_votes: ActiveVote[];
  author: string;
  author_payout_value: string;
  author_reputation: number;
  author_role?: string;
  author_title?: string;
  beneficiaries: Beneficiary[];
  blacklists: any[];
  body: string;
  category: string;
  children: number;
  community: string;
  community_title: string;
  created: string;
  curator_payout_value: string;
  depth: number;
  is_paidout: boolean;
  json_metadata: {
    app?: string;
    description?: string;
    format?: string;
    image?: string[];
    tags?: string[];
    users?: string[];
  };
  max_accepted_payout: string;
  net_rshares: number;
  payout: number;
  payout_at: string;
  pending_payout_value: string;
  percent_hbd: number;
  permlink: string;
  post_id: number;
  reblogs: number;
  replies: any[];
  stats: PostStats;
  title: string;
  updated: string;
  url: string;
}

export type PostSort = 'trending' | 'hot' | 'created';
