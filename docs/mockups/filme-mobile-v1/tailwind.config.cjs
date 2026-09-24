module.exports = {
  content: [__dirname + '/src/**/*.{jsx,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(['background', 'foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'muted', 'muted-foreground', 'input', 'border', 'ring'].map(key => [key, `hsl(var(--${key}) / <alpha-value>)`])),
    },
  },
  plugins: [],
};
