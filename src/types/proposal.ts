// Types for API items
export type Proposal = {
  proposal_id: number;
  subject: string;
  permlink: string;
  creator: string;
  receiver: string;
  start_date: string;
  end_date: string;
  total_hbd_received: string;
  max_hbd_remaining: string;
  all_votes_num: string;
  all_votes_hp: string;
  votes: Array<{ name: string; hive_power: string; proxied_hive_power: string }>;
  status?: string; // Only if available from API
  daily_pay?: {
    amount: string;
    nai: string;
    precision: number;
  };
  total_votes?: string;
  daily_pay_hbd?: number;
  remaining_days?: number;
  vote_value_total?: number;
};

export interface ProposalsListProps {
  onClickSupport: (proposal: Proposal) => void;
  onClickVoteValue: (proposal: Proposal) => void;
  onClickSelect: (proposal: Proposal) => void;
  onClickUser: (proposal: Proposal) => void;
  onClickAvatar: (proposal: Proposal) => void;
}
