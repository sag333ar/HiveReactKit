# ListOfWitnesses Component

A comprehensive React component for displaying Hive blockchain witnesses with filtering, voting status, and interactive features.

## Features

- **Responsive Design**: Works on mobile, tablet, and desktop
- **Real-time Data**: Fetches live witness data from Hive blockchain
- **Interactive Filtering**: Filter by status, name, and version
- **Vote Status Checking**: Shows if a user has voted for witnesses
- **Witness Votes Modal**: View all voters for a specific witness
- **External Links**: Direct links to witness URLs and stats
- **Version Status**: Color-coded version indicators
- **APR Calculation**: Automatic APR calculation from blockchain data

## Installation

```bash
npm install @hiveio/dhive
```

## Usage

### Basic Usage

```tsx
import { ListOfWitnesses } from 'your-package';

function App() {
  return (
    <div className="bg-gray-900 min-h-screen">
      <ListOfWitnesses />
    </div>
  );
}
```

### Advanced Usage with Custom Handlers

```tsx
import { ListOfWitnesses } from 'your-package';
import { WitnessFilters } from 'your-package';

function App() {
  const [filters, setFilters] = useState<WitnessFilters>({
    status: 'all',
    name: '',
    version: ''
  });

  const handleWitnessVoteClick = (witness: string) => {
    console.log('Vote clicked for:', witness);
    // Custom logic for vote handling
  };

  const handleWitnessStatsClick = (witness: string) => {
    window.open(`https://hivehub.dev/witnesses/${witness}`, '_blank');
  };

  const handleWitnessUrlClick = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="bg-gray-900 min-h-screen p-4">
      <ListOfWitnesses
        username="your-username" // Optional: for vote status checking
        filters={filters}
        onWitnessVoteClick={handleWitnessVoteClick}
        onWitnessStatsClick={handleWitnessStatsClick}
        onWitnessUrlClick={handleWitnessUrlClick}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `username` | `string` | No | Username to check vote status for witnesses |
| `filters` | `WitnessFilters` | No | Filter configuration object |
| `onWitnessVoteClick` | `(witness: string) => void` | No | Custom handler for vote column clicks |
| `onWitnessStatsClick` | `(witness: string) => void` | No | Custom handler for stats button clicks |
| `onWitnessUrlClick` | `(url: string) => void` | No | Custom handler for URL link clicks |

## Types

### WitnessFilters

```typescript
interface WitnessFilters {
  status: 'all' | 'active' | 'disabled' | 'approved';
  name: string;
  version: string;
}
```

### ListOfWitnessesProps

```typescript
interface ListOfWitnessesProps {
  username?: string;
  filters?: WitnessFilters;
  onWitnessVoteClick?: (witness: string) => void;
  onWitnessStatsClick?: (witness: string) => void;
  onWitnessUrlClick?: (url: string) => void;
}
```

## Data Columns

1. **Rank (Active)**: Numerical ranking of witnesses
2. **Witness**: Avatar, username, and action buttons
3. **Version**: Color-coded version status
4. **Votes (MHP)**: Total votes in millions (clickable)
5. **Last Block**: Last confirmed block number and time
6. **Miss**: Total missed blocks
7. **Price Feed**: HBD exchange rate and update time
8. **APR (%)**: Annual Percentage Rate
9. **Vote**: Checkbox indicating vote status

## Version Status Colors

- **Green**: Version is latest or higher than hardfork version
- **Red**: Version is lower than hardfork version
- **Grey**: Version is between latest and hardfork version

## Filtering

The component includes built-in filtering for:

- **Status**: Active, Disabled/Stale, Approved
- **Name**: Text search by witness name
- **Version**: Text search by version number

## Mobile Responsiveness

The component is fully responsive and includes:

- Horizontal scrolling for table on small screens
- Touch-friendly buttons and interactions
- Optimized layout for mobile devices
- Responsive typography and spacing

## Styling

The component uses Tailwind CSS classes and follows a dark theme design. Key styling features:

- Dark background (`bg-gray-900`)
- Light text (`text-white`, `text-gray-400`)
- Hover effects for interactive elements
- Consistent spacing and typography
- Color-coded status indicators

## Dependencies

- `@hiveio/dhive`: For Hive blockchain API calls
- `react`: For component functionality
- `tailwindcss`: For styling (optional, can be customized)

## API Endpoints

The component uses the following Hive API endpoints:

- `condenser_api.get_witnesses_by_vote`: Fetch witness data
- `condenser_api.get_accounts`: Get account details for vote status
- `database_api.list_witness_votes`: Get witness voters list

## Error Handling

The component includes comprehensive error handling:

- Loading states for all async operations
- Error messages for failed API calls
- Graceful fallbacks for missing data
- Retry mechanisms for network issues

## Performance

- Efficient data fetching with pagination
- Memoized callbacks to prevent unnecessary re-renders
- Lazy loading for large datasets
- Optimized API calls to reduce blockchain load

## Customization

The component can be customized through:

- Custom CSS classes
- Custom event handlers
- Custom filter logic
- Custom styling themes
- Custom API endpoints

## Examples

See `ListOfWitnessesExample.tsx` for a complete working example with all features demonstrated.
