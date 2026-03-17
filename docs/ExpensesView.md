# ExpensesView Component

A full-page transparent expense breakdown component for the Hive ecosystem. Displays a month-by-month table of operational costs from January 2022 to present, with year totals, capital investments, and a grand total — all switchable across USD, HIVE, and INR currencies using live rates.

## Features

- **Live currency conversion** — Fetches live HIVE/USD and USD/INR rates from CoinGecko; falls back to static rates on failure
- **Three currencies** — Toggle between USD, HIVE, and INR
- **Responsive table** — Full column table on desktop; collapsible accordion rows on mobile
- **Summary cards** — Total recurring expenses, capital investments, grand total, and revenue (zero)
- **Capital investments** — Separate breakdown of IT infrastructure and furniture/fixtures
- **Monthly categories** — Explains each recurring cost category with amounts
- **"The Hard Truth" section** — Narrative context, witness vote CTA
- **Debt vs Revenue bar** — Visual comparison of total spend vs zero revenue
- **Themeable** — Accepts the same color props as `HiveContributionsLanding` for a seamless transition

## Installation

```bash
npm install hive-react-kit
```

## Usage

### Standalone

```tsx
import { ExpensesView } from 'hive-react-kit';

function App() {
  return (
    <ExpensesView
      onBack={() => console.log('back')}
    />
  );
}
```

### With local state (toggle from landing)

```tsx
import { HiveContributionsLanding, ExpensesView } from 'hive-react-kit';
import { useState } from 'react';

function App() {
  const [showExpenses, setShowExpenses] = useState(false);

  if (showExpenses) {
    return (
      <ExpensesView
        onBack={() => setShowExpenses(false)}
        backgroundColor="#020617"
        textColor="#e5e7eb"
        cardBackgroundColor="rgba(15,23,42,0.9)"
        dividerColor="rgba(148,163,184,0.4)"
      />
    );
  }

  return (
    <HiveContributionsLanding
      isExpensesCTA={true}
      onViewExpenses={() => setShowExpenses(true)}
    />
  );
}
```

### With React Router

```tsx
import { ExpensesView } from 'hive-react-kit';
import { useNavigate } from 'react-router-dom';

const ExpensesPage = () => {
  const navigate = useNavigate();
  return (
    <ExpensesView
      onBack={() => navigate('/contributions')}
      backgroundColor="#020617"
      textColor="#e5e7eb"
      cardBackgroundColor="rgba(15,23,42,0.9)"
      dividerColor="rgba(148,163,184,0.4)"
    />
  );
};
```

### Custom theme

```tsx
<ExpensesView
  onBack={handleBack}
  backgroundColor="#0f172a"
  textColor="#f1f5f9"
  cardBackgroundColor="rgba(30,41,59,0.9)"
  dividerColor="rgba(100,116,139,0.4)"
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onBack` | `() => void` | **required** | Called when the "Back to Contributions View" button is clicked. Use to navigate back or hide the component. |
| `backgroundColor` | `string` | `"#111827"` | Page background color. |
| `textColor` | `string` | `"#e5e7eb"` | Main body text color. |
| `cardBackgroundColor` | `string` | `"rgba(15,23,42,0.85)"` | Background color for table, summary cards, and detail cards. |
| `dividerColor` | `string` | `"rgba(148,163,184,0.4)"` | Color of table row borders and section dividers. |

## Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | **Hero** | Title, transparency badge, and witness vote ask. |
| 2 | **Currency switcher** | Toggle between USD, HIVE, and INR. Shows live rates from CoinGecko. |
| 3 | **Month-by-Month Table** | Full expense breakdown per month, grouped by year with year subtotals. Desktop table / mobile accordion. |
| 4 | **Summary Cards** | Total recurring, capital investments, grand total, and revenue (zero). |
| 5 | **Capital Investments** | IT infrastructure and furniture/fixtures one-time costs. |
| 6 | **Monthly Categories** | Explains developer salaries, rent, utilities, VPS, dev programs, and depreciation. |
| 7 | **The Hard Truth** | Narrative section with witness vote CTA button. |
| 8 | **Debt vs Revenue** | Visual progress bar comparing total debt to zero revenue. |

## Expense Data

Expenses are computed from January 2022 through March 2026. All base amounts are stored in USD and converted at runtime using live rates.

| Category | Period | Base Amount (USD/mo) |
|---|---|---|
| Developer salaries (3 devs) | Jan 2022 – Jan 2026 | $1,250 |
| Developer salaries (2 devs) | Feb 2026 – present | $900 |
| Office rent | Jul 2022 – present | $300 |
| Utilities (internet, electricity) | Jul 2022 – present | $50 |
| VPS & hosting | Jul 2022 – present | $175 |
| Dev programs (Apple/Google) | Jul 2022 – present | $15 |
| Domains | Jul 2022 – present | $15 |
| IT infrastructure depreciation | Jul 2022 – present | $50 (10%/yr, declining) |
| IT infrastructure maintenance | Jul 2022 – present | $20 (5%/yr, declining) |
| Furniture depreciation | Jul 2022 – present | $30 (15%/yr, declining) |

Capital investments (one-time):

| Item | Base Amount (USD) |
|---|---|
| IT Infrastructure | $6,000 |
| Furniture & Fixtures | $2,400 |

## Currency Support

| Currency | Symbol | Source |
|---|---|---|
| USD | $ | Base (no conversion) |
| INR | ₹ | CoinGecko `hive.inr / hive.usd` |
| HIVE | HIVE | CoinGecko `1 / hive.usd` |

Fallback rates (used when CoinGecko is unreachable): `1 HIVE = $0.07`, `1 USD = ₹85`.

## Styling note

The component uses Tailwind CSS utility classes and `react-icons/fa` for icons. When used as an npm package, import the compiled stylesheet:

```tsx
import 'hive-react-kit/build.css';
```

## Dependencies

- React 16.8+
- Tailwind CSS
- `react-icons`
- CoinGecko public API (optional — falls back to static rates)
