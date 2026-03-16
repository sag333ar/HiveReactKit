import React from 'react';
import { AppModel } from '../../types/AppModel';
import AppTile from './AppTile';
import { useResponsive } from '../../utils/responsive';

interface AppsGridProps {
  apps: AppModel[];
  cardBackgroundColor?: string;
  cardShadow?: string;
}

const AppsGrid: React.FC<AppsGridProps> = ({ apps, cardBackgroundColor, cardShadow }) => {
  const { isMobileView, isTabletView } = useResponsive();

  const getGridCols = () => {
    if (isMobileView) return 'grid-cols-1';
    if (isTabletView) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className="container mx-auto px-4 lg:px-16">
      <div className={`grid ${getGridCols()} gap-6 lg:gap-8`}>
        {apps.map((app, index) => (
          <AppTile
            key={index}
            app={app}
            backgroundColor={cardBackgroundColor}
            boxShadow={cardShadow}
          />
        ))}
      </div>
    </div>
  );
};

export default AppsGrid;