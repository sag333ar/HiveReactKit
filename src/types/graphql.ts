export interface GQLActiveVoter {
  percent: number;
  rshares: number;
  voter: string;
  weight: number;
}

export interface GQLStats {
  active_voters: GQLActiveVoter[];
  num_comments: number;
  num_votes: number;
  total_hive_reward: number;
}

export interface GQLAuthor {
  username: string;
}

export interface GQLVideoItem {
  created_at: string;
  title: string;
  // Optional fields from HivePost fragment
  permlink?: string;
  lang?: string;
  tags?: string[];
  spkvideo?: any;
  stats?: GQLStats;
  author?: GQLAuthor;
  json_metadata?: {
    raw: any;
  };
}