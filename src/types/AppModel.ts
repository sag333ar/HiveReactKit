export enum AppStatus {
  LIVE = 'live',
  COMING_SOON = 'comingSoon'
}

export interface AppModel {
  imagePath: string;
  name: string;
  url: string;
  description: string;
  useCircleBackground?: boolean;
  status?: AppStatus;
  isComingSoon?: boolean;
}