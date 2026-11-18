/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Inter',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
      },
      colors: {
        cal: {
          bg: '#f8fafc',
          darkbg: '#090d16',
          surface: '#ffffff',
          darksurface: '#131b2e',
          border: '#e2e8f0',
          darkborder: '#1e293b'
        }
      }
    },
  },
  plugins: [],
}
