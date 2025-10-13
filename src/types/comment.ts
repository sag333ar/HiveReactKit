/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Discussion {
  active_votes: any[];
  author: string;
  permlink: string;
  parent_author?: string;
  parent_permlink?: string;
  title?: string;
  body?: string;
  created?: string;
  depth?: number;
  children?: number;
  net_votes?: number;
  stats?: {
    total_votes: number;
  };
  json_metadata?: string;
  json_metadata_parsed?: any;
  replies?: string[] | Discussion[];
}
