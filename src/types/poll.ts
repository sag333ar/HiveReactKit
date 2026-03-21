/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PollChoiceVotes {
  total_votes: number;
  hive_hp?: number;
  hive_proxied_hp?: number;
  hive_hp_incl_proxied?: number;
  spl_spsp?: number;
  he_token?: number | null;
  colony_colonyp?: number;
  glx_glxp?: number;
}

export interface PollChoice {
  choice_num: number;
  choice_text: string;
  votes?: PollChoiceVotes | null;
}

export interface PollVoter {
  name: string;
  choices?: number[];
  choice_num?: number;
  hive_hp?: number;
  glx_glxp?: number;
  he_token?: number | null;
  spl_spsp?: number;
  colony_colonyp?: number;
  hive_proxied_hp?: number;
  hive_hp_incl_proxied?: number;
}

export interface PollStats {
  total_voting_accounts_num: number;
  total_hive_hp: number;
  total_hive_proxied_hp: number;
  total_hive_hp_incl_proxied: number;
  total_spl_spsp: number;
  total_he_token: number | null;
  total_colony_colonyp: number;
  total_glx_glxp: number;
}

export interface Poll {
  poll_trx_id: string;
  question: string;
  post_title?: string;
  post_body?: string;
  author: string;
  permlink: string;
  created: string;
  end_time: string;
  status: "Active" | "Ended";
  max_choices_voted: number | null;
  filter_account_age_days: number;
  preferred_interpretation: string;
  token: string | null;
  ui_hide_res_until_voted: boolean;
  poll_choices: PollChoice[];
  poll_voters?: PollVoter[];
  poll_stats?: PollStats | null;
  tags?: string[];
  image?: string[] | null;
  platform?: string;
  allow_vote_changes?: boolean;
  category?: string;
  parent_permlink?: string;
  parent_author?: string;
  protocol_version?: number;
}
