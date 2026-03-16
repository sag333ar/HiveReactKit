import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileView = screenSize.width < 850;
  const isTabletView = screenSize.width <= 1050 && screenSize.width >= 850;
  const isWebView = screenSize.width > 1050;

  return { isMobileView, isTabletView, isWebView, screenSize };
};

export const getResponsiveClass = (mobile: string, tablet: string, desktop: string) => {
  return `${mobile} md:${tablet} lg:${desktop}`;
};