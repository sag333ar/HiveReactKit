# Wallet

A dark-mode wallet component that displays Hive account balances, estimated USD value, and transaction history (transfers).

## Installation

```bash
npm install hive-react-kit
```

```tsx
import { Wallet } from 'hive-react-kit';
import 'hive-react-kit/build.css';
```

## Quick Start

```tsx
<Wallet username="sagarkothari88" />
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `username` | `string` | No | `undefined` | Hive username to fetch wallet data for |
| `className` | `string` | No | `""` | Additional CSS classes for the container |

## What It Displays

### Profile Header
- User avatar from `https://images.hive.blog/u/{username}/avatar`
- Username and "Hive Wallet Overview" subtitle

### Estimated Value Card
- Gradient card (blue-to-purple) showing total USD estimated value
- Calculated from liquid HIVE + staked HP converted via feed price

### Balance Tiles
| Tile | Color | Description |
|------|-------|-------------|
| Balance | Blue | Liquid HIVE balance |
| HBD Balance | Emerald | Liquid HBD (Hive Backed Dollars) |
| Savings Balance | Amber | HIVE in savings |
| Savings HBD | Purple | HBD in savings |
| Hive Power | Orange | Staked HP (converted from vesting shares) |

### Transaction History
- Fetches recent transfer operations via `condenser_api.get_account_history`
- Shows sent (red arrow up) and received (green arrow down) transfers
- Each row displays: direction icon, user avatar, username, "Sent"/"Received" label, time ago, and color-coded amount
- Transaction count header

## Data Source

Uses the `useWalletStore` Zustand store which:
- Fetches account data via `@hiveio/dhive` client (`database.getAccounts`)
- Converts vesting shares to Hive Power using dynamic global properties
- Converts HIVE to USD using feed history median price
- Fetches transfer history via JSON-RPC `condenser_api.get_account_history` (filtered for transfer operations, default limit: 100)

## States

| State | Description |
|-------|-------------|
| Loading | Spinner animation on estimated value card |
| Error | Red error banner with warning icon |
| Transactions Loading | Spinner with "Loading transactions..." text |
| No Transactions | "No transactions found" empty state |

## Example

```tsx
import { Wallet } from 'hive-react-kit';
import 'hive-react-kit/build.css';

const WalletPage = () => (
  <div className="max-w-md mx-auto p-4 bg-gray-900 min-h-screen">
    <Wallet username="sagarkothari88" />
  </div>
);
```

## Zustand Store

The Wallet component uses `useWalletStore` which is also exported for direct use:

```tsx
import { useWalletStore } from 'hive-react-kit';

const MyComponent = () => {
  const { walletData, transactions, fetchWalletData, fetchTransactions } = useWalletStore();

  useEffect(() => {
    fetchWalletData('sagarkothari88');
    fetchTransactions('sagarkothari88');
  }, []);

  return <div>{walletData?.estimated_value}</div>;
};
```

### Store Shape

```ts
interface WalletStore {
  walletData: WalletData | null;
  isLoading: boolean;
  error: string | null;
  transactions: Transaction[];
  isLoadingTransactions: boolean;
  transactionError: string | null;

  setWalletData: (data: WalletData | null) => void;
  clearWalletData: () => void;
  fetchWalletData: (username: string) => Promise<WalletData>;
  fetchTransactions: (username: string, limit?: number) => Promise<Transaction[]>;
}
```

## TypeScript

```tsx
import type { WalletData, Transaction } from 'hive-react-kit';

// WalletData
interface WalletData {
  balance: string;            // e.g. "100.000 HIVE"
  hbd_balance: string;        // e.g. "50.000 HBD"
  savings_balance: string;
  savings_hbd_balance: string;
  hive_power: string;         // e.g. "1000.000 HP"
  estimated_value: string;    // e.g. "$500.00"
  error?: string;
}

// Transaction
interface Transaction {
  id: number;
  timestamp: string;
  type: "sent" | "received";
  amount: string;             // e.g. "0.001 HBD"
  from: string;
  to: string;
  memo: string;
  trx_id: string;
}
```
