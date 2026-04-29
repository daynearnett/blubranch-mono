// Single source of truth for breakpoints. Reactive — subscribes to
// `useWindowDimensions` so the layout swaps automatically on web resize
// and on native rotation.
import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

export interface Layout {
  /** Active layout mode */
  mode: LayoutMode;
  /** width < 768 — bottom tabs, single column */
  isMobile: boolean;
  /** 768 ≤ width < 1024 — collapsed sidebar, content area */
  isTablet: boolean;
  /** width ≥ 1024 — expanded sidebar, content area, optional detail panel */
  isDesktop: boolean;
  /** Suggested column count for grid layouts */
  columns: 1 | 2 | 3;
  /** Live viewport width in CSS / dp */
  screenWidth: number;
  /** Live viewport height in CSS / dp */
  screenHeight: number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const isMobile = width < BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = !isMobile && !isDesktop;
  const mode: LayoutMode = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  const columns: 1 | 2 | 3 = isMobile ? 1 : isTablet ? 2 : 3;
  return {
    mode,
    isMobile,
    isTablet,
    isDesktop,
    columns,
    screenWidth: width,
    screenHeight: height,
  };
}
