import React from 'react';
// @ts-ignore
import rtcLogoImg from '../assets/images/regenerated_image_1782454218803.png';

interface RtcLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  layout?: 'vertical' | 'horizontal';
  theme?: 'dark' | 'light';
}

export const RtcLogo: React.FC<RtcLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  layout = 'vertical',
  theme = 'light'
}) => {
  // Determine dimensions based on size prop
  const dimensions = {
    sm: 'h-10 w-auto',
    md: 'h-16 w-auto',
    lg: 'h-28 w-auto',
    xl: 'h-48 w-auto'
  }[size];

  return (
    <div className={`flex items-center justify-center ${layout === 'vertical' ? 'flex-col text-center' : 'flex-row text-left'} ${className}`} id="rtc-logo-container">
      {/* Exact official Royal Thimphu College logo image */}
      <img
        src={rtcLogoImg}
        className={`${dimensions} object-contain transition-transform hover:scale-105 duration-300`}
        alt="Royal Thimphu College Logo"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

