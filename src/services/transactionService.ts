/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "@hiveio/dhive";
import { 
  TransactionHistoryItem, 
  TransactionHistoryParams, 
  TransactionHistoryResponse,
  Operation 
} from "@/types/transaction";

// Initialize DHive client
const dhiveClient = new Client([
  "https://api.hive.blog",
  "https://api.syncad.com",
  "https://api.deathwing.me",
]);

class TransactionService {
  /**
   * Get transaction history for an account
   * @param account - Hive account name
   * @param index - Starting index (-1 for most recent)
   * @param limit - Maximum number of transactions to return (default: 1000)
   * @param start - Start block number (optional)
   * @param stop - Stop block number (optional)
   * @returns Promise<TransactionHistoryItem[]>
   */
  async getTransactionHistory(
    account: string,
    index: number = -1,
    limit: number = 1000,
    start: number | null = null,
    stop: number | null = null
  ): Promise<TransactionHistoryItem[]> {
    try {
      // Prepare request parameters
      const params: any[] = [account, index, limit];
      if (start !== null && stop !== null) {
        params.push(start, stop);
      }

      const result = await dhiveClient.call(
        "condenser_api",
        "get_account_history",
        params
      );

      // Return raw operation history
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error("Error in getTransactionHistory:", error);
      return [];
    }
  }

  /**
   * Get filtered transaction history by operation type
   * @param account - Hive account name
   * @param operationTypes - Array of operation types to filter by
   * @param limit - Maximum number of transactions to return
   * @returns Promise<TransactionHistoryItem[]>
   */
  async getFilteredTransactionHistory(
    account: string,
    operationTypes: string[] = [],
    limit: number = 100
  ): Promise<TransactionHistoryItem[]> {
    try {
      const allTransactions = await this.getTransactionHistory(account, -1, 1000);
      
      let filtered = allTransactions;
      
      if (operationTypes.length > 0) {
        filtered = allTransactions.filter(transaction => {
          const opType = transaction.op?.[0];
          return operationTypes.includes(opType);
        });
      }

      return filtered.slice(0, limit);
    } catch (error) {
      console.error("Error in getFilteredTransactionHistory:", error);
      return [];
    }
  }

  /**
   * Get recent transfers for an account
   * @param account - Hive account name
   * @param limit - Maximum number of transfers to return
   * @returns Promise<TransactionHistoryItem[]>
   */
  async getRecentTransfers(account: string, limit: number = 50): Promise<TransactionHistoryItem[]> {
    return this.getFilteredTransactionHistory(account, ['transfer'], limit);
  }

  /**
   * Get recent votes for an account
   * @param account - Hive account name
   * @param limit - Maximum number of votes to return
   * @returns Promise<TransactionHistoryItem[]>
   */
  async getRecentVotes(account: string, limit: number = 50): Promise<TransactionHistoryItem[]> {
    return this.getFilteredTransactionHistory(account, ['vote'], limit);
  }

  /**
   * Get recent comments/posts for an account
   * @param account - Hive account name
   * @param limit - Maximum number of comments to return
   * @returns Promise<TransactionHistoryItem[]>
   */
  async getRecentComments(account: string, limit: number = 50): Promise<TransactionHistoryItem[]> {
    return this.getFilteredTransactionHistory(account, ['comment'], limit);
  }

  /**
   * Parse operation data from transaction
   * @param transaction - Transaction history item
   * @returns Parsed operation or null
   */
  parseOperation(transaction: TransactionHistoryItem): Operation | null {
    try {
      if (!transaction.op || !Array.isArray(transaction.op) || transaction.op.length < 2) {
        return null;
      }

      const [opType, opData] = transaction.op;

      switch (opType) {
        case 'transfer':
          return {
            type: 'transfer',
            value: {
              from: opData.from || '',
              to: opData.to || '',
              amount: opData.amount || '',
              memo: opData.memo || ''
            }
          } as Operation;

        case 'vote':
          return {
            type: 'vote',
            value: {
              voter: opData.voter || '',
              author: opData.author || '',
              permlink: opData.permlink || '',
              weight: opData.weight || 0
            }
          } as Operation;

        case 'comment':
          return {
            type: 'comment',
            value: {
              parent_author: opData.parent_author || '',
              parent_permlink: opData.parent_permlink || '',
              author: opData.author || '',
              permlink: opData.permlink || '',
              title: opData.title || '',
              body: opData.body || '',
              json_metadata: opData.json_metadata || ''
            }
          } as Operation;

        case 'custom_json':
          return {
            type: 'custom_json',
            value: {
              required_auths: opData.required_auths || [],
              required_posting_auths: opData.required_posting_auths || [],
              id: opData.id || '',
              json: opData.json || ''
            }
          } as Operation;

        default:
          return null;
      }
    } catch (error) {
      console.error("Error parsing operation:", error);
      return null;
    }
  }

  /**
   * Format transaction timestamp to readable date
   * @param timestamp - Transaction timestamp
   * @returns Formatted date string
   */
  formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return timestamp;
    }
  }

  /**
   * Get transaction summary statistics
   * @param transactions - Array of transactions
   * @returns Summary statistics
   */
  getTransactionSummary(transactions: TransactionHistoryItem[]): {
    totalTransactions: number;
    operationCounts: Record<string, number>;
    dateRange: { earliest: string; latest: string };
  } {
    const operationCounts: Record<string, number> = {};
    let earliest = '';
    let latest = '';

    transactions.forEach(transaction => {
      const opType = transaction.op?.[0] || 'unknown';
      operationCounts[opType] = (operationCounts[opType] || 0) + 1;

      if (!earliest || transaction.timestamp < earliest) {
        earliest = transaction.timestamp;
      }
      if (!latest || transaction.timestamp > latest) {
        latest = transaction.timestamp;
      }
    });

    return {
      totalTransactions: transactions.length,
      operationCounts,
      dateRange: { earliest, latest }
    };
  }
}

export const transactionService = new TransactionService();
