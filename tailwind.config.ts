import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17181A',
        paper: '#F1F0EC',
        panel: '#FFFFFF',
        line: '#DAD7CF',
        teal: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
          light: 'rgb(var(--brand-light) / <alpha-value>)',
        },
        amber: {
          DEFAULT: '#E8A33D',
          dark: '#C6811F',
          light: '#FBEDD6',
        },
        success: '#2F9E5B',
        danger: '#C4432E',
        info: {
          DEFAULT: '#3F6FBF',
          dark: '#2C4F91',
          light: '#E6ECFA',
        },
        accent: {
          name: 'rgb(var(--name-brand) / <alpha-value>)',
          price: 'rgb(var(--price-brand) / <alpha-value>)',
          tagline: 'rgb(var(--tagline-brand) / <alpha-value>)',
          pill: 'rgb(var(--pill-text-brand) / <alpha-value>)',
        },
        storebg: 'rgb(var(--bg-brand) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        card: '18px',
        tag: '10px',
      },
      boxShadow: {
        tag: '0 1px 2px rgba(23,24,26,0.06), 0 8px 20px -12px rgba(23,24,26,0.18)',
      },
    },
  },
  plugins: [],
}
export default config
