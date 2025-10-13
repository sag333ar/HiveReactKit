import React, { useState, useEffect } from "react";
import {
  Activity,
  ArrowUpDown,
  MessageCircle,
  Send,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react";
import { transactionService } from "@/services/transactionService";
import { userService } from "@/services/userService";
import { TransactionHistoryItem, Operation } from "@/types/transaction";

interface TransactionHistoryProps {
  account: string;
  className?: string;
}

function TransactionHistory({ account, className }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>(
    []
  );
  const [filteredTransactions, setFilteredTransactions] = useState<
    TransactionHistoryItem[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [operationFilter, setOperationFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const operationTypes = [
    { value: "all", label: "All Operations", icon: Activity },
    { value: "transfer", label: "Transfers", icon: Send },
    { value: "vote", label: "Votes", icon: TrendingUp },
    { value: "comment", label: "Comments", icon: MessageCircle },
    { value: "custom_json", label: "Custom JSON", icon: ArrowUpDown },
    {
      value: "comment_payout_update",
      label: "Payout Updates",
      icon: RefreshCw,
    },
    { value: "comment_options", label: "Comment Options", icon: Filter },
    { value: "effective_comment_vote", label: "Effective Votes", icon: Users },
  ];

  const loadTransactions = async () => {
    if (!account) return;

    setLoading(true);
    setError(null);

    try {
      const data = await transactionService.getTransactionHistory(
        account,
        -1,
        limit
      );
      setTransactions(data);
      setFilteredTransactions(data);
    } catch (err) {
      setError("Failed to load transaction history");
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [account, limit]);

  useEffect(() => {
    let filtered = transactions;

    // Filter by operation type
    if (operationFilter !== "all") {
      filtered = filtered.filter((tx) => tx.op?.[0] === operationFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((tx) => {
        const op = transactionService.parseOperation(tx);
        if (!op) return false;

        switch (op.type) {
          case "transfer":
            return (
              op.value.from.toLowerCase().includes(lowerSearchTerm) ||
              op.value.to.toLowerCase().includes(lowerSearchTerm) ||
              op.value.memo.toLowerCase().includes(lowerSearchTerm)
            );
          case "vote":
            return (
              op.value.voter.toLowerCase().includes(lowerSearchTerm) ||
              op.value.author.toLowerCase().includes(lowerSearchTerm) ||
              op.value.permlink.toLowerCase().includes(lowerSearchTerm)
            );
          case "comment":
            return (
              op.value.author.toLowerCase().includes(lowerSearchTerm) ||
              op.value.title.toLowerCase().includes(lowerSearchTerm) ||
              op.value.permlink.toLowerCase().includes(lowerSearchTerm)
            );
          default:
            return false;
        }
      });
    }

    setFilteredTransactions(filtered);
  }, [transactions, operationFilter, searchTerm]);

  const renderOperationIcon = (operation: Operation | null) => {
    if (!operation) return <Activity className="h-4 w-4" />;

    const IconComponent =
      operationTypes.find((op) => op.value === operation.type)?.icon ||
      Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  const renderOperationDetails = (transaction: TransactionHistoryItem) => {
    const operation = transactionService.parseOperation(transaction);
    if (!operation)
      return <span className="text-gray-400">Unknown operation</span>;

    switch (operation.type) {
      case "transfer":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Transfer
              </span>
              <span className="text-sm font-medium text-white">
                {operation.value.amount}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              From:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.from}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              To:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.to}
              </span>
            </div>
            {operation.value.memo && (
              <div className="text-sm text-gray-400">
                Memo: {operation.value.memo}
              </div>
            )}
          </div>
        );

      case "vote":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Vote
              </span>
              <span className="text-sm font-medium text-white">
                {operation.value.weight}%
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Voter:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.voter}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Post: @{operation.value.author}/{operation.value.permlink}
            </div>
          </div>
        );

      case "comment":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Comment
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Author:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.author}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Title: {operation.value.title}
            </div>
            <div className="text-sm text-gray-400">
              Permlink: {operation.value.permlink}
            </div>
          </div>
        );

      case "custom_json":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Custom JSON
              </span>
            </div>
            <div className="text-sm text-gray-400">
              ID: {operation.value.id}
            </div>
            <div className="text-sm text-gray-400">
              JSON: {operation.value.json.substring(0, 100)}...
            </div>
          </div>
        );

      case "comment_payout_update":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Payout Update
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Author:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.author}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Permlink: {operation.value.permlink}
            </div>
          </div>
        );

      case "comment_options":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Comment Options
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Author:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.author}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Max Payout: {operation.value.max_accepted_payout}
            </div>
            <div className="text-sm text-gray-400">
              HBD Percent: {operation.value.percent_hbd}%
            </div>
          </div>
        );

      case "effective_comment_vote":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium">
                Effective Vote
              </span>
              <span className="text-sm font-medium text-white">
                {operation.value.weight}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Voter:{" "}
              <span className="font-mono text-gray-300">
                {operation.value.voter}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Post: @{operation.value.author}/{operation.value.permlink}
            </div>
            <div className="text-sm text-gray-400">
              Pending Payout: {operation.value.pending_payout}
            </div>
          </div>
        );

      default:
        return <span className="text-gray-400">Unknown operation</span>;
    }
  };

  const summary = transactionService.getTransactionSummary(transactions);

  if (loading) {
    return (
      <div
        className={`bg-gray-800 border border-gray-700 rounded-lg shadow-sm ${className}`}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-gray-300" />
            <h3 className="text-lg font-semibold text-white">
              Transaction History
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400">
              Loading transaction history for
            </p>
            <img
              src={userService.userAvatar(account)}
              alt={`${account} avatar`}
              className="w-6 h-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  userService.userAvatar(account);
              }}
            />
            <p className="text-sm text-gray-400">
              @{account}
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-700 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-lg shadow-sm ${className}`}
    >
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-gray-300" />
          <h3 className="text-lg font-semibold text-white">
            Transaction History
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">
            Transaction history for
          </p>
          <img
            src={userService.userAvatar(account)}
            alt={`${account} avatar`}
            className="w-6 h-6 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                userService.userAvatar(account);
            }}
          />
          <p className="text-sm text-gray-400">
          @{account}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.totalTransactions}
            </div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.operationCounts.transfer || 0}
            </div>
            <div className="text-sm text-gray-400">Transfers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.operationCounts.vote || 0}
            </div>
            <div className="text-sm text-gray-400">Votes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {summary.operationCounts.comment || 0}
            </div>
            <div className="text-sm text-gray-400">Comments</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {operationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <select
            value={limit.toString()}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="w-full sm:w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
          <button
            onClick={loadTransactions}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-4 border border-red-700 bg-red-900 rounded-md">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Transaction List */}
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No transactions found
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const operation = transactionService.parseOperation(transaction);
              return (
                <div
                  key={`${transaction.trx_id}-${transaction.op_in_trx}`}
                  className="border border-gray-600 rounded-lg p-4 space-y-3 hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {renderOperationIcon(operation)}
                      <div>
                        <div className="font-medium text-white">
                          {operation?.type
                            ? operation.type.charAt(0).toUpperCase() +
                              operation.type.slice(1)
                            : "Unknown"}
                        </div>
                        <div className="text-sm text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {transactionService.formatTimestamp(
                            transaction.timestamp
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        Block #{transaction.block}
                      </div>
                      {/* <div className="text-xs text-muted-foreground font-mono">
                        {transaction.trx_id.substring(0, 8)}...
                      </div> */}
                    </div>
                  </div>

                  <div className="ml-7">
                    {renderOperationDetails(transaction)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredTransactions.length > 0 && (
          <div className="text-center text-sm text-gray-400">
            Showing {filteredTransactions.length} of {transactions.length}{" "}
            transactions
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistory;
