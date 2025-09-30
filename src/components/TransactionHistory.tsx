import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Users
} from 'lucide-react';
import { transactionService } from '@/services/transactionService';
import { TransactionHistoryItem, Operation } from '@/types/transaction';

interface TransactionHistoryProps {
  account: string;
  className?: string;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ account, className }) => {
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [limit, setLimit] = useState(50);

  const operationTypes = [
    { value: 'all', label: 'All Operations', icon: Activity },
    { value: 'transfer', label: 'Transfers', icon: Send },
    { value: 'vote', label: 'Votes', icon: TrendingUp },
    { value: 'comment', label: 'Comments', icon: MessageCircle },
    { value: 'custom_json', label: 'Custom JSON', icon: ArrowUpDown }
  ];

  const loadTransactions = async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await transactionService.getTransactionHistory(account, -1, limit);
      setTransactions(data);
      setFilteredTransactions(data);
    } catch (err) {
      setError('Failed to load transaction history');
      console.error('Error loading transactions:', err);
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
    if (operationFilter !== 'all') {
      filtered = filtered.filter(tx => tx.op?.[0] === operationFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => {
        const op = transactionService.parseOperation(tx);
        if (!op) return false;

        switch (op.type) {
          case 'transfer':
            return (
              op.value.from.toLowerCase().includes(lowerSearchTerm) ||
              op.value.to.toLowerCase().includes(lowerSearchTerm) ||
              op.value.memo.toLowerCase().includes(lowerSearchTerm)
            );
          case 'vote':
            return (
              op.value.voter.toLowerCase().includes(lowerSearchTerm) ||
              op.value.author.toLowerCase().includes(lowerSearchTerm) ||
              op.value.permlink.toLowerCase().includes(lowerSearchTerm)
            );
          case 'comment':
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

    const IconComponent = operationTypes.find(op => op.value === operation.type)?.icon || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  const renderOperationDetails = (transaction: TransactionHistoryItem) => {
    const operation = transactionService.parseOperation(transaction);
    if (!operation) return <span className="text-muted-foreground">Unknown operation</span>;

    switch (operation.type) {
      case 'transfer':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Transfer</Badge>
              <span className="text-sm font-medium">{operation.value.amount}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              From: <span className="font-mono">{operation.value.from}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              To: <span className="font-mono">{operation.value.to}</span>
            </div>
            {operation.value.memo && (
              <div className="text-sm text-muted-foreground">
                Memo: {operation.value.memo}
              </div>
            )}
          </div>
        );

      case 'vote':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Vote</Badge>
              <span className="text-sm font-medium">{operation.value.weight}%</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Voter: <span className="font-mono">{operation.value.voter}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Post: @{operation.value.author}/{operation.value.permlink}
            </div>
          </div>
        );

      case 'comment':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Comment</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Author: <span className="font-mono">{operation.value.author}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Title: {operation.value.title}
            </div>
            <div className="text-sm text-muted-foreground">
              Permlink: {operation.value.permlink}
            </div>
          </div>
        );

      case 'custom_json':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Custom JSON</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              ID: {operation.value.id}
            </div>
            <div className="text-sm text-muted-foreground">
              JSON: {operation.value.json.substring(0, 100)}...
            </div>
          </div>
        );

      default:
        return <span className="text-muted-foreground">Unknown operation</span>;
    }
  };

  const summary = transactionService.getTransactionSummary(transactions);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Loading transaction history for @{account}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Transaction History
        </CardTitle>
        <CardDescription>
          Transaction history for @{account}
        </CardDescription>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.totalTransactions}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.operationCounts.transfer || 0}</div>
            <div className="text-sm text-muted-foreground">Transfers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.operationCounts.vote || 0}</div>
            <div className="text-sm text-muted-foreground">Votes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.operationCounts.comment || 0}</div>
            <div className="text-sm text-muted-foreground">Comments</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={operationFilter} onValueChange={setOperationFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {operationTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadTransactions} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Transaction List */}
        <div className="space-y-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const operation = transactionService.parseOperation(transaction);
              return (
                <div
                  key={`${transaction.trx_id}-${transaction.op_in_trx}`}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {renderOperationIcon(operation)}
                      <div>
                        <div className="font-medium">
                          {operation?.type ? operation.type.charAt(0).toUpperCase() + operation.type.slice(1) : 'Unknown'}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {transactionService.formatTimestamp(transaction.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
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
          <div className="text-center text-sm text-muted-foreground">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
