/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#000000', // True black for iOS dark mode feel
          surface: '#121212', // Slightly elevated surface
          glass: 'rgba(28, 28, 30, 0.75)', // Transparent dark grey for frosted glass (iOS secondary system bg)
          glassBorder: 'rgba(255, 255, 255, 0.1)',
          glassHover: 'rgba(44, 44, 46, 0.85)',
          primary: '#0A84FF', // iOS Blue
          primaryHover: '#007AFF', // iOS Blue active
          danger: '#FF453A', // iOS Red dark mode
          dangerHover: '#FF3B30', // iOS Red active
          textPrimary: '#FFFFFF',
          textSecondary: '#EBEBF5', // rgba(235, 235, 245, 0.6) Equivalent iOS secondary text
          textMuted: 'rgba(235, 235, 245, 0.3)',
        }
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.5)',
        'glass-sm': '0 2px 10px rgba(0, 0, 0, 0.3)',
      },
      backdropBlur: {
        'ios': '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        }
      }
    },
  },
  plugins: [],
};
