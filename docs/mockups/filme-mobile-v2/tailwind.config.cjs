module.exports = {
  content: [__dirname + "/../../../src/components/moods/*.tsx", __dirname + "/../../../src/components/ui/VisibilityCheckbox.tsx", __dirname + "/../filme-mobile-v1/src/ui/*.tsx", __dirname + "/../../../src/components/v2/Wordmark.tsx", __dirname + '/src/**/*.{jsx,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(['background', 'foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'muted', 'muted-foreground', 'input', 'border', 'ring'].map(key => [key, `hsl(var(--${key}) / <alpha-value>)`])),
    },
  },
  plugins: [],
};
