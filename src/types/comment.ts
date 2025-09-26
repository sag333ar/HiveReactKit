/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Discussion {
  author: string;
  permlink: string;
  title?: string;
  body?: string;
  created?: string;
  depth?: number;
  children?: number;
  net_votes?: number;
  json_metadata?: string;
  json_metadata_parsed?: any;
  replies?: Discussion[];
}