# HiveContributionsLanding Component

A configurable, full-page landing component for showcasing Hive ecosystem contributions. Covers vision & mission, beliefs, app status lists, contributions grid, supporters, and an optional expenses CTA — all with a consistent, themeable dark UI.

## Features

- **Configurable theme** — Background, text, card, and divider colors via props
- **Lucide icons** — Uses `lucide-react` for all icons (no inline SVGs)
- **Expenses CTA** — Optional CTA card in the Vision section; fires `onViewExpenses` callback so the consumer controls navigation
- **Supporters section** — Built-in default supporters with an `extraSupporters` prop for extensibility
- **Responsive** — Mobile, tablet, and desktop layouts throughout

## Installation

```bash
npm install hive-react-kit
```

## Usage

### Basic (default dark theme)

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';

function App() {
  return <HiveContributionsLanding />;
}
```

### Custom colors

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';

function App() {
  return (
    <HiveContributionsLanding
      backgroundColor="#020617"
      textColor="#e5e7eb"
      cardBackgroundColor="rgba(15,23,42,0.9)"
      isDividerShow={true}
      dividerColor="rgba(148,163,184,0.4)"
    />
  );
}
```

### With expenses CTA and navigation callback

Use `onViewExpenses` to open `ExpensesView` however suits your app (router navigation, modal, local state, etc.):

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
import { HiveContributionsLanding } from 'hive-react-kit';
import { useNavigate } from 'react-router-dom';

const ContributionsPage = () => {
  const navigate = useNavigate();
  return (
    <HiveContributionsLanding
      backgroundColor="#020617"
      textColor="#e5e7eb"
      cardBackgroundColor="rgba(15,23,42,0.9)"
      isExpensesCTA={true}
      onViewExpenses={() => navigate('/expenses')}
    />
  );
};
```

### With extra supporters

Pass additional supporters to append after the built-in defaults:

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';

function App() {
  return (
    <HiveContributionsLanding
      extraSupporters={[
        {
          title: "Inspired by @arcange",
          description: "Inspired by Arcange's Engage app",
          avatar: "https://images.ecency.com/webp/u/arcange/avatar/medium",
          link: "https://peakd.com/@arcange",
          buttonText: "View",
        },
      ]}
    />
  );
}
```

### Light theme

```tsx
<HiveContributionsLanding
  backgroundColor="#f8fafc"
  textColor="#0f172a"
  cardBackgroundColor="rgba(255,255,255,0.9)"
  dividerColor="rgba(148,163,184,0.5)"
/>
```

### Without dividers

```tsx
<HiveContributionsLanding isDividerShow={false} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `backgroundColor` | `string` | `"#020617"` | Page background color (any valid CSS color). |
| `textColor` | `string` | `"#e5e7eb"` | Main body text color inherited by all sections. |
| `cardBackgroundColor` | `string` | `"rgba(15,23,42,0.85)"` | Background color for Vision/Mission/Goal cards, belief cards, app tiles, and supporter cards. |
| `isDividerShow` | `boolean` | `true` | Whether to show horizontal dividers between sections. |
| `dividerColor` | `string` | `"rgba(148,163,184,0.4)"` | Color of the horizontal divider lines. |
| `isExpensesCTA` | `boolean` | `false` | Shows a CTA card in the Vision section. Clicking it fires `onViewExpenses`. |
| `onViewExpenses` | `() => void` | `undefined` | Callback fired when the "View Expenses" CTA is clicked. Use this to navigate to or render `ExpensesView`. |
| `extraSupporters` | `SupporterItem[]` | `[]` | Additional supporter cards to append after the 4 built-in defaults. |

## SupporterItem type

```ts
interface SupporterItem {
  title: string;       // Card heading (e.g. "Powered by Hive.io")
  description: string; // Short subtitle text
  avatar: string;      // URL of the avatar/logo image
  link: string;        // href for the action button
  buttonText: string;  // Label on the action button (e.g. "View", "Visit")
}
```

## Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | **Vision & Mission** | Vision, Mission, and Goal cards. Optional Expenses CTA when `isExpensesCTA={true}`. |
| 2 | **What We Believe** | Four belief cards: Simplicity, Open Ecosystem, Build First, Community. |
| 3 | **Apps We've Built & What's Coming** | Delivered apps (green badges), In Development (amber badges), and Planned (blue badges). |
| 4 | **Contributions** | Grid of all apps from the internal `appsData` (via `AppsGrid`). |
| 5 | **Supporters & Partners** | Grid of supporter cards. 4 built-in defaults + any `extraSupporters`. Ends with a Discord contact card. |

## Default Supporters

The following are always shown in the Supporters section:

| Title | Link |
|-------|------|
| Powered by Hive.io | https://hive.io/ |
| Cheered by @starkerz | https://peakd.com/@starkerz |
| Encouraged by @theycallmedan | https://peakd.com/@theycallmedan |
| Github | https://github.com/orgs/TechCoderLabz/repositories |

Use `extraSupporters` to add more without replacing these defaults.

## Styling note

The component uses Tailwind CSS utility classes and `lucide-react` for icons. When used as an npm package, import the compiled stylesheet:

```tsx
import 'hive-react-kit/build.css';
```

Or add the package path to your Tailwind `content` array so the consumer's build includes the classes:

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/hive-react-kit/dist/**/*.js',
  ],
};
```

## Dependencies

- React 16.8+
- Tailwind CSS
- `lucide-react`
