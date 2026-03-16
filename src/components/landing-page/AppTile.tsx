import React from 'react';
import { AppModel } from '../../types/AppModel';
import { launchUrl } from '../../utils/actions';

interface AppTileProps {
  app: AppModel;
  backgroundColor?: string;
  boxShadow?: string;
}

const AppTile: React.FC<AppTileProps> = ({ app, backgroundColor, boxShadow }) => {
  const handleClick = () => {
    launchUrl(app.url);
  };

  return (
    <div
      className="card hover-lift cursor-pointer transition-all duration-300 h-full"
      onClick={handleClick}
      style={{
        backgroundColor: backgroundColor ?? 'rgba(15,23,42,0.9)',
        boxShadow: boxShadow ?? '0 18px 45px rgba(0,0,0,0.6)',
        border: '1px solid rgba(148,163,184,0.25)',
      }}
    >
      <div className="card-body p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {app.useCircleBackground !== false ? (
              <div className="avatar">
                <div className="w-16 h-16 rounded-full">
                  <img 
                    src={app.imagePath} 
                    alt={`${app.name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </div>
              </div>
            ) : (
              <img 
                src={app.imagePath} 
                alt={`${app.name} logo`}
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h3 className="card-title text-lg font-bold text-base-content mb-2 line-clamp-2">
                {app.name}
              </h3>
              {app.isComingSoon && (
                <div className="badge badge-warning badge-sm">Coming Soon</div>
              )}
            </div>
            
            <div className="text-base-content/70 text-sm leading-relaxed">
              {app.description.split('\n').map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppTile;