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
          DEFAULT: '#0E7C6B',
          dark: '#0A5C4F',
          light: '#E4F1EE',
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
