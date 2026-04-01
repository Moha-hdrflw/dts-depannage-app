/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#060d16',
          800: '#0d1a2b',
          700: '#142236',
          600: '#1a2d45',
          500: '#243d5c',
        },
        accent: {
          DEFAULT: '#b8d400',
          dark: '#96ac00',
          light: '#d4f000',
        }
      },
    },
  },
  plugins: [],
}
