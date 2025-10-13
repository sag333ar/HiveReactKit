import { Client } from "@hiveio/dhive";
import { Witness, WitnessVotesResponse, Account, WitnessVote } from "../types/witness";

// Use dev proxy paths to avoid CORS in development. Vite proxy maps these to real RPC nodes.
const dhiveClient = new Client([
  "https://api.hive.blog",
  "https://api.syncad.com",
  "https://api.deathwing.me",
]);

class WitnessService {
  /**
   * Get witnesses by vote with pagination
   */
  async getWitnessesByVote(start: string = "", limit: number = 60): Promise<Witness[]> {
    try {
      const result = await dhiveClient.call(
        "condenser_api",
        "get_witnesses_by_vote",
        [start, limit]
      );
      return result as Witness[];
    } catch (error) {
      console.error("Error fetching witnesses by vote:", error);
      throw error;
    }
  }

  /**
   * Get account details including witness votes
   */
  async getAccount(username: string): Promise<Account | null> {
    try {
      const result = await dhiveClient.call(
        "condenser_api",
        "get_accounts",
        [[username]]
      );
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("Error fetching account:", error);
      return null;
    }
  }

  /**
   * Get multiple accounts at once
   */
  async getAccounts(usernames: string[]): Promise<Account[]> {
    try {
      const result = await dhiveClient.call(
        "condenser_api",
        "get_accounts",
        [usernames]
      );
      return result as Account[];
    } catch (error) {
      console.error("Error fetching accounts:", error);
      return [];
    }
  }

  /**
   * Get witness votes for a specific witness
   */
  async getWitnessVotes(
    witness: string,
    start: string = "",
    limit: number = 250
  ): Promise<WitnessVotesResponse> {
    try {
      const result = await dhiveClient.call(
        "database_api",
        "list_witness_votes",
        {
          start: [witness, start],
          limit,
          order: "by_witness_account"
        }
      );
      return result as WitnessVotesResponse;
    } catch (error) {
      console.error("Error fetching witness votes:", error);
      throw error;
    }
  }

  /**
   * Get all witness votes for a witness with pagination
   */
  async getAllWitnessVotes(witness: string): Promise<WitnessVote[]> {
    const allVotes: WitnessVote[] = [];
    let start = "";
    const limit = 250;

    try {
      while (true) {
        const response = await this.getWitnessVotes(witness, start, limit);
        allVotes.push(...response.votes);

        if (response.votes.length < limit) {
          break;
        }

        start = response.votes[response.votes.length - 1].account;
      }

      return allVotes;
    } catch (error) {
      console.error("Error fetching all witness votes:", error);
      return [];
    }
  }

  /**
   * Check if a user has voted for a witness
   */
  async hasUserVotedForWitness(username: string, witness: string): Promise<boolean> {
    try {
      const account = await this.getAccount(username);
      if (!account || !account.witness_votes) {
        return false;
      }
      return account.witness_votes.includes(witness);
    } catch (error) {
      console.error("Error checking witness vote:", error);
      return false;
    }
  }

  /**
   * Get user's witness votes
   */
  async getUserWitnessVotes(username: string): Promise<string[]> {
    try {
      const account = await this.getAccount(username);
      return account?.witness_votes || [];
    } catch (error) {
      console.error("Error fetching user witness votes:", error);
      return [];
    }
  }

  /**
   * Format votes to millions (MHP)
   */
  formatVotesToMHP(votes: string): string {
    const votesNum = parseFloat(votes);
    const millions = votesNum / 1000000;
    return `${millions.toFixed(1)}m`;
  }

  /**
   * Calculate APR from hbd_interest_rate
   */
  calculateAPR(hbdInterestRate: number): number {
    return hbdInterestRate / 100;
  }

  /**
   * Get version status color based on running_version vs hardfork_version_vote
   */
  getVersionStatus(runningVersion: string, hardforkVersion: string): 'green' | 'red' | 'grey' {
    const running = this.parseVersion(runningVersion);
    const hardfork = this.parseVersion(hardforkVersion);
    
    if (this.compareVersions(running, hardfork) >= 0) {
      return 'green';
    } else if (this.compareVersions(running, hardfork) < 0) {
      return 'red';
    }
    return 'grey';
  }

  /**
   * Parse version string to comparable format
   */
  private parseVersion(version: string): number[] {
    return version.split('.').map(num => parseInt(num, 10));
  }

  /**
   * Compare two version arrays
   */
  private compareVersions(version1: number[], version2: number[]): number {
    const maxLength = Math.max(version1.length, version2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1 = version1[i] || 0;
      const v2 = version2[i] || 0;
      
      if (v1 > v2) return 1;
      if (v1 < v2) return -1;
    }
    
    return 0;
  }

  /**
   * Get witness description from account metadata
   */
  getWitnessDescription(account: Account): string {
    try {
      let metadata;
      if (account.json_metadata && account.json_metadata !== '{}') {
        metadata = JSON.parse(account.json_metadata);
        const desc = metadata.profile?.witness_description;
        if (desc) return desc;
      }
      if (account.posting_json_metadata && account.posting_json_metadata !== '{}') {
        metadata = JSON.parse(account.posting_json_metadata);
        return metadata.profile?.about || '';
      }
      return '';
    } catch (error) {
      console.error('Error parsing witness description:', error);
      return '';
    }
  }

  /**
   * Format time ago
   */
  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} second${diffInSeconds > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) { // 7 days
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 2592000) { // 30 days
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 31536000) { // 365 days
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  }
}

export const witnessService = new WitnessService();
