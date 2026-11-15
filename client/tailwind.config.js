/** @type {import('tailwindcss').Config} */
const brand = name => `rgb(var(--aethra-${name}-rgb) / <alpha-value>)`;
export default {
  content: {relative: true, files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']},
  theme: {
    extend: {
      colors: {
        aethra: {night: brand('night'), cyan: brand('cyan'), ink: brand('ink'), black: brand('black'), paper: brand('paper'), white: brand('white'), link: 'var(--aethra-link)'},
        surface: {DEFAULT: 'var(--aethra-white)', card: 'var(--aethra-white)', bg: 'var(--aethra-paper)', border: 'var(--aethra-border)', muted: 'var(--aethra-muted)'},
        dark: {DEFAULT: 'var(--aethra-night)', 50: '#14243C', 100: '#14243C', 800: '#14243C', 900: '#07142B', 950: '#0A0D12'},
        whatsapp: {DEFAULT: '#137A45', hover: '#0F6237'}
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Cairo', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Outfit', '"IBM Plex Sans Arabic"', 'Cairo', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      borderRadius: {control: 'var(--aethra-radius-control)', card: 'var(--aethra-radius-card)'},
      boxShadow: {saas: 'none', 'saas-lg': 'none', 'brand-signal': 'none'}
    }
  },
  plugins: []
};
