import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        linus: '0 18px 60px rgba(0, 0, 0, 0.36)'
      }
    }
  },
  plugins: []
} satisfies Config;
