import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './store/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        muted: 'var(--muted)',
        text: 'var(--text)',
        subtext: 'var(--subtext)',
        accent: 'var(--accent)',
        protein: 'var(--protein)',
        fat: 'var(--fat)',
        carbs: 'var(--carbs)',
        danger: 'var(--danger)'
      },
      boxShadow: {
        card: '0 12px 40px rgba(18, 26, 43, 0.08)',
        soft: '0 4px 16px rgba(18, 26, 43, 0.12)'
      },
      borderRadius: {
        xl2: '1.375rem'
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    }
  },
  plugins: []
};

export default config;
