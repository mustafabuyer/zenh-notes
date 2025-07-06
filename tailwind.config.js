/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian dark theme colors
        'obsidian': {
          'bg': '#202020',
          'bg-secondary': '#262626',
          'bg-tertiary': '#2a2a2a',
          'border': '#333333',
          'text': '#e0e0e0',
          'text-muted': '#999999',
          'text-faint': '#666666',
          'accent': '#7f6df2',
          'accent-hover': '#8b7ff3',
          'success': '#4caf50',
          'warning': '#ff9800',
          'error': '#f44336'
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}