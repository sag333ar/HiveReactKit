import { Proposal } from '../types/proposal';

export class ProposalService {
  private static instance: ProposalService;

  public static getInstance(): ProposalService {
    if (!ProposalService.instance) {
      ProposalService.instance = new ProposalService();
    }
    return ProposalService.instance;
  }

  async getProposals(status: string): Promise<Proposal[]> {
    if (status === 'expired') {
      return this.getExpiredProposals();
    } else {
      return this.getActiveProposals();
    }
  }

  private async getActiveProposals(): Promise<Proposal[]> {
    try {
      // Get active proposals using official Hive API
      const proposalsRes = await fetch('https://api.hive.blog/', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          'content-type': 'application/json',
          'origin': 'https://peakd.com',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          "id": 72,
          "jsonrpc": "2.0",
          "method": "database_api.list_proposals",
          "params": {
            "start": [-1],
            "limit": 500,
            "order": "by_total_votes",
            "order_direction": "descending",
            "status": "votable"
          }
        })
      });

      const proposalsJson = await proposalsRes.json();
      const proposals = proposalsJson.result.proposals;

      // Get additional data from stats.hivehub.dev
      const statsRes = await fetch('https://stats.hivehub.dev/dhf_proposals');
      const statsJson = await statsRes.json();

      // Create a map of stats data by proposal_id
      const statsMap: { [key: number]: any } = {};
      statsJson.forEach((stat: any) => {
        statsMap[stat.proposal_id] = stat;
      });

      // Get proposal votes for active proposals
      const votesRes = await fetch('https://api.hive.blog/', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          'content-type': 'application/json',
          'origin': 'https://peakd.com',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          "id": 73,
          "jsonrpc": "2.0",
          "method": "database_api.list_proposal_votes",
          "params": {
            "start": ["shaktimaaan"],
            "limit": 1000,
            "order": "by_voter_proposal",
            "order_direction": "ascending",
            "status": "votable"
          }
        })
      });

      const votesJson = await votesRes.json();
      const proposalVotes = votesJson.result.proposal_votes || [];

      // Group votes by proposal_id
      const votesByProposal: { [key: number]: any[] } = {};
      proposalVotes.forEach((vote: any) => {
        if (!votesByProposal[vote.proposal.proposal_id]) {
          votesByProposal[vote.proposal.proposal_id] = [];
        }
        votesByProposal[vote.proposal.proposal_id].push(vote);
      });

      // Transform the data to match our interface
      return proposals.map((proposal: any) => {
        const proposalId = proposal.id;
        const stats = statsMap[proposalId];
        const votes = votesByProposal[proposalId] || [];
        const totalHp = votes.reduce((sum: number, vote: any) => sum + parseFloat(vote.total_hbd || '0'), 0);

        return {
          proposal_id: proposalId,
          subject: proposal.subject,
          permlink: proposal.permlink,
          creator: proposal.creator,
          receiver: proposal.receiver,
          start_date: proposal.start_date,
          end_date: proposal.end_date,
          total_hbd_received: stats ? stats.total_hbd_received : '0',
          max_hbd_remaining: stats ? stats.max_hbd_remaining : '0',
          all_votes_num: proposal.total_votes || '0',
          all_votes_hp: stats ? stats.all_votes_hp : totalHp.toString(),
          votes: stats ? stats.votes : votes,
          status: proposal.status,
          daily_pay: proposal.daily_pay,
          total_votes: proposal.total_votes,
          daily_pay_hbd: proposal.daily_pay ? Number(proposal.daily_pay.amount) / Math.pow(10, proposal.daily_pay.precision) : 0,
          remaining_days: Math.max(0, Math.ceil((new Date(proposal.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))),
          vote_value_total: stats ? parseFloat(stats.all_votes_hp) : totalHp
        };
      });
    } catch (error) {
      console.error("Error fetching active proposals:", error);
      return [];
    }
  }

  private async getExpiredProposals(): Promise<Proposal[]> {
    try {
      // First get the proposals
      const proposalsRes = await fetch('https://api.hive.blog/', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          'content-type': 'application/json',
          'origin': 'https://peakd.com',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          "id": 65,
          "jsonrpc": "2.0",
          "method": "database_api.list_proposals",
          "params": {
            "start": [-1],
            "limit": 500,
            "order": "by_total_votes",
            "order_direction": "descending",
            "status": "expired"
          }
        })
      });

      const proposalsJson = await proposalsRes.json();
      const proposals = proposalsJson.result.proposals;

      // Then get the proposal votes
      const votesRes = await fetch('https://api.hive.blog/', {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          'content-type': 'application/json',
          'origin': 'https://peakd.com',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          "id": 76,
          "jsonrpc": "2.0",
          "method": "database_api.list_proposal_votes",
          "params": {
            "start": ["shaktimaaan"],
            "limit": 1000,
            "order": "by_voter_proposal",
            "order_direction": "ascending",
            "status": "expired"
          }
        })
      });

      const votesJson = await votesRes.json();
      const proposalVotes = votesJson.result.proposal_votes || [];

      // Group votes by proposal_id
      const votesByProposal: { [key: number]: any[] } = {};
      proposalVotes.forEach((vote: any) => {
        if (!votesByProposal[vote.proposal_id]) {
          votesByProposal[vote.proposal_id] = [];
        }
        votesByProposal[vote.proposal_id].push(vote);
      });

      // Transform the data to match our interface
      return proposals.map((proposal: any) => {
        const proposalId = proposal.id;
        const votes = votesByProposal[proposalId] || [];

        return {
          proposal_id: proposalId,
          subject: proposal.subject,
          permlink: proposal.permlink,
          creator: proposal.creator,
          receiver: proposal.receiver,
          start_date: proposal.start_date,
          end_date: proposal.end_date,
          total_hbd_received: '0', // Not available in expired API
          max_hbd_remaining: '0', // Not available
          all_votes_num: proposal.total_votes || '0',
          all_votes_hp: '0', // HP values not available for expired proposals
          votes: votes,
          status: proposal.status,
          daily_pay: proposal.daily_pay,
          total_votes: proposal.total_votes,
          daily_pay_hbd: proposal.daily_pay ? Number(proposal.daily_pay.amount) / Math.pow(10, proposal.daily_pay.precision) : 0,
          remaining_days: 0, // Expired, so 0
          vote_value_total: 0 // HP values not available for expired proposals
        };
      });
    } catch (error) {
      console.error("Error fetching expired proposals:", error);
      return [];
    }
  }
}

export const proposalService = ProposalService.getInstance();
