import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Palette "premium dark"
        ink: '#0a0a0f', // background principal (quasi-noir)
        surface: '#111118', // cards / surfaces
        panel: '#0d0d14', // sidebar
        hairline: 'rgba(255,255,255,0.06)', // bordures
      },
      boxShadow: {
        glow: '0 0 20px rgba(99,102,241,0.15)',
        'glow-strong': '0 0 32px rgba(99,102,241,0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
