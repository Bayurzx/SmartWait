// apps\mobile\src\utils\responsive.ts 
import { Dimensions, Platform, ViewStyle, TextStyle } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

// Breakpoints for responsive design
export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

// Get current screen size category
export const getScreenSize = (): keyof typeof breakpoints => {
  if (screenWidth >= breakpoints.xl) return 'xl';
  if (screenWidth >= breakpoints.lg) return 'lg';
  if (screenWidth >= breakpoints.md) return 'md';
  if (screenWidth >= breakpoints.sm) return 'sm';
  return 'xs';
};

// Check if screen is at least a certain size
export const isScreenSize = (size: keyof typeof breakpoints): boolean => {
  return screenWidth >= breakpoints[size];
};

// Responsive value helper
export const responsive = <T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
}): T | undefined => {
  const currentSize = getScreenSize();

  // Return the value for current size or fall back to smaller sizes
  return values[currentSize] ||
    values.lg ||
    values.md ||
    values.sm ||
    values.xs;
};

// Responsive padding/margin helper
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Get responsive spacing
export const getSpacing = (size: keyof typeof spacing): number => {
  const screenSize = getScreenSize();

  // Adjust spacing based on screen size
  const multiplier = screenSize === 'xs' ? 0.8 :
    screenSize === 'sm' ? 0.9 :
      screenSize === 'md' ? 1 :
        screenSize === 'lg' ? 1.1 : 1.2;

  return spacing[size] * multiplier;
};

// Responsive font sizes
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

// Get responsive font size
export const getFontSize = (size: keyof typeof fontSize): number => {
  const screenSize = getScreenSize();

  // Adjust font size based on screen size
  const multiplier = screenSize === 'xs' ? 0.9 :
    screenSize === 'sm' ? 0.95 :
      screenSize === 'md' ? 1 :
        screenSize === 'lg' ? 1.05 : 1.1;

  return fontSize[size] * multiplier;
};

// Container max width for web
export const getContainerMaxWidth = (): number => {
  if (!isWeb) return screenWidth;

  const screenSize = getScreenSize();

  switch (screenSize) {
    case 'xl':
      return 600;
    case 'lg':
      return 500;
    case 'md':
      return 400;
    default:
      return screenWidth;
  }
};

// Web-specific styles - properly typed for React Native
export const webStyles: ViewStyle = {
  ...(isWeb && {
    maxWidth: getContainerMaxWidth(),
    alignSelf: 'center',
    width: '100%',
  }),
};

// Container styles that work across platforms
export const getWebContainerStyle = (): ViewStyle => ({
  maxWidth: getContainerMaxWidth(),
  alignSelf: 'center',
  width: '100%',
});

// Platform-specific adjustments
export const platformStyles = {
  // Input styles that work well on both platforms
  input: {
    minHeight: 50,
    textAlignVertical: 'center' as const,
  } as ViewStyle & {
    // Web-specific properties that TypeScript should ignore
    outlineStyle?: string;
    cursor?: string;
  },

  // Button styles
  button: {
    minHeight: 48,
  } as ViewStyle & {
    // Web-specific properties
    cursor?: string;
    userSelect?: string;
  },

  // Text selection
  text: {} as TextStyle & {
    // Web-specific properties
    userSelect?: string;
  },
};

// Web-specific style additions (to be applied conditionally)
export const getWebSpecificStyles = () => ({
  input: isWeb ? {
    outlineStyle: 'none',
    cursor: 'text',
  } : {},

  button: isWeb ? {
    cursor: 'pointer',
    userSelect: 'none',
  } : {},

  text: isWeb ? {
    userSelect: 'text',
  } : {},

  container: isWeb ? {
    minHeight: '100vh',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  } : {},

  submitButton: isWeb ? {
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease-in-out',
  } : {},

  inputBox: isWeb ? {
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  } : {},
});

export default {
  isWeb,
  isMobile,
  breakpoints,
  getScreenSize,
  isScreenSize,
  responsive,
  spacing,
  getSpacing,
  fontSize,
  getFontSize,
  getContainerMaxWidth,
  webStyles,
  getWebContainerStyle,
  platformStyles,
  getWebSpecificStyles,
};