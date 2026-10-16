/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#800020',
          dark: '#5a0017',
          soft: '#f4b6c4',
        },
        ink: '#26070e',
        paper: '#f8f5f4',
        line: '#ebe5e3',
      },
      // Tailwind v3 belum punya ukuran xs/2xs (itu fitur v4), jadi didefinisikan di sini.
      boxShadow: {
        '2xs': '0 1px 0 0 rgb(15 23 42 / 0.04)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};