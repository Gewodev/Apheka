/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#020203',
        'bg-secondary': '#07080A',
        'surface': '#0B0C0F',
        'surface-elevated': '#101115',
        'surface-hover': '#15171B',
        'accent': '#E11D48',
        'accent-soft': 'rgba(225, 29, 72, 0.14)',
        'accent-glow': 'rgba(225, 29, 72, 0.28)',
        'text-primary': 'rgba(255, 255, 255, 0.92)',
        'text-secondary': 'rgba(255, 255, 255, 0.62)',
        'text-muted': 'rgba(255, 255, 255, 0.36)',
        'border-soft': 'rgba(255, 255, 255, 0.05)',
        'border-hover': 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['64px', '1'],
        'display-lg': ['52px', '1'],
        'heading-xl': ['40px', '1'],
        'heading-lg': ['32px', '1'],
        'heading-md': ['24px', '1'],
        'body-lg': ['16px', '1.5'],
        'body-md': ['14px', '1.5'],
        'body-sm': ['13px', '1.5'],
        'label': ['11px', '1'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '24px',
        '6': '32px',
        '7': '40px',
        '8': '48px',
        '9': '64px',
      },
      transitionDuration: {
        'default': '220ms',
      },
      transitionTimingFunction: {
        'default': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      borderRadius: {
        'card': '12px',
      },
      boxShadow: {
        'accent-glow': '0 0 24px rgba(225, 29, 72, 0.28)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}