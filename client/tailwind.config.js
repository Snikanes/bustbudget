/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        budget: {
          green: '#059669',
          yellow: '#d97706',
          red: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
