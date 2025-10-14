import { Follower, Following, UserProfileResponse, Account } from "@/types/user";

class UserService {
  private readonly HIVE_API_URL = 'https://api.hive.blog';

  async getProfile(username: string): Promise<UserProfileResponse> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'bridge.get_profile',
      params: {
        account: username,
      },
      id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  async getFollowers(username: string): Promise<Follower[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_followers',
      params: [username, null, 'blog'],
      id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }

  async getFollowing(username: string): Promise<Following[]> {
    const requestBody = {
        jsonrpc: '2.0',
        method: 'condenser_api.get_following',
        params: [username, null, 'blog'],
        id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }

  async getAccounts(usernames: string[]): Promise<Account[]> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_accounts',
      params: [usernames],
      id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }

  async getDynamicGlobalProperties(): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_dynamic_global_properties',
      params: [],
      id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }

  async convertVestingSharesToHive(vestingShares: string): Promise<string> {
    try {
      const props = await this.getDynamicGlobalProperties();
      const vestingSharesFloat = parseFloat(vestingShares.split(' ')[0]);
      const totalVestingShares = parseFloat(
        props.total_vesting_shares.split(' ')[0]
      );
      const totalVestingFundHive = parseFloat(
        props.total_vesting_fund_hive.split(' ')[0]
      );
      const hiveValue = (
        (vestingSharesFloat * totalVestingFundHive) /
        totalVestingShares
      ).toFixed(3);
      return hiveValue;
    } catch (error) {
      console.error('Error converting vesting shares:', error);
      return '0';
    }
  }

  async getFeedHistory(): Promise<any> {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'condenser_api.get_feed_history',
      params: [],
      id: 1,
    };

    const response = await fetch(this.HIVE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  }

  async getVoteValue(username: string, weight: number = 10000): Promise<string> {
    try {
      const accounts = await this.getAccounts([username]);
      if (accounts.length === 0) {
        throw new Error('Account not found!');
      }
      const account = accounts[0];

      // Get dynamic global properties for vote calculation
      const props = await this.getDynamicGlobalProperties();
      const feedHistory = await this.getFeedHistory();

      // Calculate vote value using the standard Hive vote value formula
      const totalShares =
        parseFloat(account.vesting_shares) +
        parseFloat(account.received_vesting_shares) -
        parseFloat(account.delegated_vesting_shares) -
        parseFloat(account.vesting_withdraw_rate);

      const elapsed = Math.floor(Date.now() / 1000) - account.voting_manabar.last_update_time;
      const maxMana = (totalShares * 1000000) / 4;

      let currentMana =
        parseFloat(account.voting_manabar.current_mana.toString()) +
        (elapsed * maxMana) / (5 * 60 * 60 * 24);

      if (currentMana > maxMana) {
        currentMana = maxMana;
      }

      const currentVotingPower = (currentMana * 100) / maxMana;

      // Calculate rshares (reward shares)
      const vestingSharesStr = account.vesting_shares || '0 VESTS';
      const vestingShares = parseFloat(vestingSharesStr.toString().split(' ')[0]);
      const totalVestingSharesStr = props.total_vesting_shares || '0 VESTS';
      const totalVestingShares = parseFloat(totalVestingSharesStr.toString().split(' ')[0]);
      const votePercent = weight / 10000; // weight is in basis points (10000 = 100%)
      const usedPower = (currentVotingPower * votePercent) / 100;
      const maxVoteDenom = props.vote_power_reserve_rate * (5 * 60 * 60 * 24) / (60 * 60 * 24);
      const usedMana = (usedPower * maxMana) / 100;

      // Simplified vote value calculation
      const recentClaims = parseFloat(props.recent_claims || '0');
      const rewardBalanceStr = props.reward_balance || '0 HIVE';
      const rewardBalance = parseFloat(rewardBalanceStr.toString().split(' ')[0]);
      const currentSupplyStr = props.current_supply || '0 HIVE';
      const currentSupply = parseFloat(currentSupplyStr.toString().split(' ')[0]);
      const currentSbdSupplyStr = props.current_sbd_supply || '0 HBD';
      const currentSbdSupply = parseFloat(currentSbdSupplyStr.toString().split(' ')[0]);

      const voteValue = (rewardBalance / recentClaims) * (vestingShares / totalVestingShares) * (usedMana / maxMana) * currentSupply;

      // Convert to USD using feed price
      const currentMedian = feedHistory?.current_median_history;
      if (!currentMedian || !currentMedian.base) {
        return '0.00';
      }
      const baseAmount = parseFloat(currentMedian.base.toString().split(' ')[0]);
      const usdValue = voteValue * baseAmount;

      return usdValue.toFixed(2);
    } catch (error) {
      console.error('Error calculating vote value:', error);
      return '0.00';
    }
  }

  userAvatar(username: string): string {
    return `https://images.hive.blog/u/${username}/avatar`;
  }
}

export const userService = new UserService();
