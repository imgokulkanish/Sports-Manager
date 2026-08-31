/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Shuttle Manager's accent — used within /shuttle pages and nav.
        brand: {
          DEFAULT: '#1F6F4A',
          dark: '#155238',
          light: '#F0FDF4',
          border: '#BBF7D0',
        },
        // Cricket Manager's accent — used within /cricket pages and nav.
        pitch: {
          DEFAULT: '#1F6F4A',
          dark: '#155238',
          light: '#F0FDF4',
          border: '#BBF7D0',
        },
        // Shell chrome anchor (app icon/splash) — deliberately neutral,
        // independent of either sport's accent. See NAMING.md.
        shell: {
          DEFAULT: '#1E293B',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '150% 0' },
          '100%': { backgroundPosition: '-150% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
