import { extendTheme } from '@chakra-ui/react';

/**
 * CabConnect design system: a calm teal brand for trust/safety, warm amber
 * accent for money & promos, neutral slate surfaces. 4px spacing grid (Chakra default).
 */
const colors = {
  brand: {
    50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
    500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#115E59', 900: '#134E4A',
  },
  accent: {
    50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24',
    500: '#F59E0B', 600: '#D97706', 700: '#B45309', 800: '#92400E', 900: '#78350F',
  },
  ink: {
    50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8',
    500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1E293B', 900: '#0F172A',
  },
};

const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  colors,
  fonts: {
    heading: `'Inter', system-ui, -apple-system, sans-serif`,
    body: `'Inter', system-ui, -apple-system, sans-serif`,
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: 'ink.50', _dark: 'ink.900' },
      'bg.surface': { default: 'white', _dark: 'ink.800' },
      'bg.subtle': { default: 'ink.100', _dark: 'ink.700' },
      'text.muted': { default: 'ink.500', _dark: 'ink.400' },
      'border.subtle': { default: 'ink.200', _dark: 'ink.700' },
    },
  },
  shadows: {
    card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
    raised: '0 10px 30px -12px rgba(15,23,42,0.25)',
    outline: '0 0 0 3px rgba(20,184,166,0.45)',
  },
  radii: { card: '14px' },
  styles: {
    global: {
      body: { bg: 'bg.canvas', color: 'ink.800', WebkitFontSmoothing: 'antialiased' },
      '.leaflet-container': { fontFamily: 'inherit', borderRadius: '14px', zIndex: 0 },
      '@keyframes cc-pulse': { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.4, transform: 'scale(1.4)' } },
      '@keyframes cc-fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      '.pulse': { animation: 'cc-pulse 1.4s ease-in-out infinite' },
      '.fade-in': { animation: 'cc-fade-in .25s ease-out' },
      '@media (prefers-reduced-motion: reduce)': { '.pulse, .fade-in': { animation: 'none' } },
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'brand' },
      baseStyle: { fontWeight: 600, borderRadius: 'lg' },
      // Accessibility: white on brand.500 is only ~2.5:1. brand.700 gives ~5.5:1 (WCAG AA).
      variants: {
        solid: ({ colorScheme }) => (colorScheme === 'brand' ? {
          bg: 'brand.700', color: 'white',
          _hover: { bg: 'brand.800', _disabled: { bg: 'brand.700' } },
          _active: { bg: 'brand.900' },
        } : {}),
        outline: ({ colorScheme }) => (colorScheme === 'brand' ? { color: 'brand.700', borderColor: 'brand.300' } : {}),
        ghost: ({ colorScheme }) => (colorScheme === 'brand' ? { color: 'brand.700' } : {}),
        link: ({ colorScheme }) => (colorScheme === 'brand' ? { color: 'brand.700' } : {}),
      },
      // Touch targets: small buttons grow to ~44px on phones, stay compact on desktop.
      sizes: {
        // Explicit px: responsive objects inside theme sizes don't resolve spacing tokens.
        sm: { h: { base: '44px', md: '32px' }, minW: { base: '44px', md: '32px' } },
        xs: { h: { base: '36px', md: '24px' }, minW: { base: '36px', md: '24px' } },
      },
    },
    Link: { baseStyle: { color: 'brand.700' } },
    Input: { defaultProps: { focusBorderColor: 'brand.500' } },
    Select: { defaultProps: { focusBorderColor: 'brand.500' } },
    Textarea: { defaultProps: { focusBorderColor: 'brand.500' } },
    NumberInput: { defaultProps: { focusBorderColor: 'brand.500' } },
    PinInput: { defaultProps: { focusBorderColor: 'brand.500' } },
    Checkbox: { defaultProps: { colorScheme: 'brand' } },
    Switch: { defaultProps: { colorScheme: 'brand' } },
    Radio: { defaultProps: { colorScheme: 'brand' } },
    Tabs: { defaultProps: { colorScheme: 'brand' } },
    Progress: { defaultProps: { colorScheme: 'brand' } },
    Heading: { baseStyle: { color: 'ink.900', letterSpacing: '-0.02em' } },
    Card: {
      baseStyle: { container: { borderRadius: 'card', boxShadow: 'card', borderWidth: '1px', borderColor: 'border.subtle' } },
    },
    Table: {
      variants: {
        simple: {
          th: { textTransform: 'none', letterSpacing: 'normal', fontSize: 'xs', color: 'text.muted', fontWeight: 600, bg: 'bg.subtle' },
          td: { fontSize: 'sm' },
        },
      },
    },
    Badge: { baseStyle: { borderRadius: 'md', px: 2, textTransform: 'none', fontWeight: 600 } },
  },
});

export default theme;
