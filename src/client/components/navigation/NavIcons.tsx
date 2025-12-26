/**
 * Navigation Icons
 * SVG icons for the navigation bar
 */

import React from 'react';

export const HomeIcon: React.FC = () => (
  <svg 
    className="w-6 h-6 fill-current" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

export const ProfileIcon: React.FC = () => (
  <svg 
    className="w-6 h-6 fill-current" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

export const LeaderboardIcon: React.FC = () => (
  <svg 
    className="w-6 h-6 fill-current" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zm-6 6h4v8H4v-8zm16 8h-4v-6h4v6z" />
  </svg>
);

export const AwardsIcon: React.FC = () => (
  <svg 
    className="w-6 h-6 fill-current" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {/* Badge/Medal icon */}
    <path d="M12 2C9.24 2 7 4.24 7 7c0 1.53.69 2.9 1.78 3.82L7 22l5-3 5 3-1.78-11.18C16.31 9.9 17 8.53 17 7c0-2.76-2.24-5-5-5zm0 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
  </svg>
);

export const CreateIcon: React.FC = () => (
  <svg 
    className="w-6 h-6 fill-current" 
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
  </svg>
);
