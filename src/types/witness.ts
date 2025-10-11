export interface Witness {
  available_witness_account_subsidies: number;
  created: string;
  hardfork_time_vote: string;
  hardfork_version_vote: string;
  hbd_exchange_rate: {
    base: string;
    quote: string;
  };
  id: number;
  last_aslot: number;
  last_confirmed_block_num: number;
  last_hbd_exchange_update: string;
  last_work: string;
  owner: string;
  pow_worker: number;
  props: {
    account_creation_fee: string;
    account_subsidy_budget: number;
    account_subsidy_decay: number;
    hbd_interest_rate: number;
    maximum_block_size: number;
  };
  running_version: string;
  signing_key: string;
  total_missed: number;
  url: string;
  virtual_last_update: string;
  virtual_position: string;
  virtual_scheduled_time: string;
  votes: string;
}

export interface WitnessVote {
  account: string;
  id: number;
  witness: string;
}

export interface WitnessVotesResponse {
  votes: WitnessVote[];
}

export interface Account {
  name: string;
  witness_votes: string[];
  [key: string]: any;
}

export interface WitnessFilters {
  status: 'all' | 'active' | 'disabled' | 'approved';
  name: string;
  version: string;
}

export interface ListOfWitnessesProps {
  username?: string;
  filters?: WitnessFilters;
  onWitnessVoteClick?: (witness: string) => void;
  onWitnessStatsClick?: (witness: string) => void;
  onWitnessUrlClick?: (url: string) => void;
}
