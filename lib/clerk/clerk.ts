import { dark } from '@clerk/themes';

const sharedVariables = {
  colorPrimary: 'hsl(24, 95%, 53%)',
  borderRadius: '0.5rem',
};

const sharedElements = {
  card: 'shadow-2xl',
  headerTitle: 'text-2xl font-bold',
  headerSubtitle: 'text-muted-foreground',
  socialButtonsBlockButton: 'border border-input hover:bg-accent',
  formButtonPrimary: 'bg-primary hover:bg-primary/90',
  footerActionLink: 'text-primary hover:text-primary/80',
};

export const clerkThemeLight = {
  variables: {
    ...sharedVariables,
    colorBackground: '#ffffff',
    colorInputBackground: '#f4f4f5',
    colorInputText: '#09090b',
  },
  elements: sharedElements,
};

export const clerkThemeDark = {
  baseTheme: dark,
  variables: {
    ...sharedVariables,
    colorBackground: 'hsl(240, 10%, 3.9%)',
    colorInputBackground: 'hsl(240, 3.7%, 15.9%)',
    colorInputText: 'hsl(0, 0%, 98%)',
  },
  elements: sharedElements,
};
