/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F5F1E9',
        paper: '#FCFAF6',
        ink: '#17150F',
        gold: '#A8834A',
        'gold-lt': '#C9A961',
        taupe: '#7C7466',
        alert: '#A34A32',
        ok: '#4A6B4F',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        sans: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
