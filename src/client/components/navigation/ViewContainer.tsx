/**
 * ViewContainer Component
 * Container for different views with consistent styling
 */

import { Devvit } from '@devvit/public-api';
import type { ViewType } from '../../hooks/useNavigation.js';

export interface ViewContainerProps {
  currentView: ViewType;
  children: JSX.Element | JSX.Element[];
}

export const ViewContainer: Devvit.BlockComponent<ViewContainerProps> = (
  { children }
) => {
  return (
    <vstack 
      width="100%" 
      height="100%" 
      grow 
      backgroundColor="#F6F7F8"
    >
      {children}
    </vstack>
  );
};
