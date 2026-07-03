import defaultTheme from 'tailwindcss/defaultTheme'
import tailwindAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['ui-monospace', 'JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // Primary brand — deep blue profesional (reemplaza sky blue)
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',  // main — bg-primary-700
          800: '#1E40AF',  // hover
          900: '#1E3A8A',  // active
        },
        // Tokens semánticos de superficie (dark mode aware vía CSS vars)
        surface: 'var(--color-bg-surface)',
        subtle:  'var(--color-bg-subtle)',
        // Divisas (para badges y texto de precios)
        'currency-usd':  'var(--color-usd)',
        'currency-cop':  'var(--color-cop)',
        'currency-ves':  'var(--color-ves)',
        'currency-usdt': 'var(--color-usdt)',
      },
      boxShadow: {
        // Sombra para modales (no existe en Tailwind default)
        'modal': 'var(--shadow-modal)',
      },
    },
  },
  plugins: [tailwindAnimate],
}
