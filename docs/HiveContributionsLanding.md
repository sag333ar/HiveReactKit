# HiveContributionsLanding Component

A configurable landing page component for showcasing Hive ecosystem contributions: vision & mission, beliefs, delivered/in-development/planned apps, and a grid of contribution apps. Designed for reuse across multiple apps with consistent theming.

## Features

- **Configurable theme** – Background, text, card, divider colors and visibility
- **Self-contained** – No `react-icons` dependency; uses inline SVGs for package compatibility
- **Sections** – Developer witness CTA, Vision/Mission/Goal, beliefs, app status lists, contributions grid, contact footer
- **Responsive** – Layout adapts to mobile, tablet, and desktop

## Installation

```bash
npm install hive-react-kit
```

## Usage

### Basic Usage (default theme)

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';

function App() {
  return <HiveContributionsLanding />;
}
```

### With custom colors

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

### Light theme example

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';

function App() {
  return (
    <HiveContributionsLanding
      backgroundColor="#f8fafc"
      textColor="#0f172a"
      cardBackgroundColor="rgba(255,255,255,0.9)"
      dividerColor="rgba(148,163,184,0.5)"
    />
  );
}
```

### Without dividers

```tsx
<HiveContributionsLanding isDividerShow={false} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|--------------|
| `backgroundColor` | `string` | `"#020617"` | Page background color (any valid CSS color). |
| `textColor` | `string` | `"#e5e7eb"` | Main text color (inherited by content). |
| `cardBackgroundColor` | `string` | `"rgba(15,23,42,0.85)"` | Background for all cards (Vision, Mission, Goal, beliefs, app status, and contribution tiles). |
| `isDividerShow` | `boolean` | `true` | Whether to show horizontal dividers between sections. |
| `dividerColor` | `string` | `"rgba(148,163,184,0.4)"` | Color of the divider lines. |

## Sections

1. **Developer witness** – CTA to vote for witness (uses `DeveloperWitness`).
2. **Vision & Mission** – Vision, Mission, and Goal cards.
3. **What we believe** – Four belief cards (Simplicity, Open Ecosystem, Build First, Community).
4. **Apps we’ve built & what’s coming** – Delivered apps, In Development, and Planned lists.
5. **Contributions** – Grid of apps from `appsData` (via `AppsGrid` / `AppTile`).
6. **Contact** – Footer with contact links (uses `Contact`).

## Styling

- Uses Tailwind-style utility classes. Ensure your app includes the package’s `build.css` (or equivalent) and that Tailwind (or compatible) is configured so classes like `card`, `glass-effect`, `hover-lift`, `badge-*`, `text-primary`, etc. apply.
- Card shadow is fixed internally (`0 18px 45px rgba(0,0,0,0.6)`). Card color is controlled by `cardBackgroundColor`.

## Dependencies

- **React** (peer)
- **Tailwind CSS** (or compatible utility CSS) in the consuming app
- Internal: `AppsGrid`, `AppTile`, `Contact`, `DeveloperWitness`, and `apps` from `appsData` (all from the same package)

## Package usage note

When used as an npm package, this component does **not** use `react-icons`. Icons are inline SVGs to avoid “Objects are not valid as a React child” when the consumer’s React instance differs from a bundled one.

## Example with React Router

```tsx
import { HiveContributionsLanding } from 'hive-react-kit';
import { Route } from 'react-router-dom';

<Route path="/contributions" element={<HiveContributionsLanding />} />
```
