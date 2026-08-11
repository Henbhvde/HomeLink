/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-display)'],
      },
      colors: {
        onyx: 'rgb(var(--color-onyx) / <alpha-value>)',
        charcoal: 'rgb(var(--color-charcoal) / <alpha-value>)',
        sand: {
          50: 'rgb(var(--color-sand-50) / <alpha-value>)', 100: 'rgb(var(--color-sand-100) / <alpha-value>)',
          200: 'rgb(var(--color-sand-200) / <alpha-value>)', 300: 'rgb(var(--color-sand-300) / <alpha-value>)',
          400: 'rgb(var(--color-sand-400) / <alpha-value>)', 500: 'rgb(var(--color-sand-500) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-sand) / <alpha-value>)', 600: 'rgb(var(--color-sand-600) / <alpha-value>)',
          700: 'rgb(var(--color-sand-700) / <alpha-value>)', 800: 'rgb(var(--color-sand-800) / <alpha-value>)', 900: 'rgb(var(--color-sand-900) / <alpha-value>)',
        },
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
      },
      spacing: { control: 'var(--space-control)', card: 'var(--space-card)', section: 'var(--space-section)' },
      borderRadius: { control: 'var(--radius-control)', card: 'var(--radius-card)', modal: 'var(--radius-modal)' },
      boxShadow: { card: 'var(--shadow-card)', modal: 'var(--shadow-modal)', focus: 'var(--shadow-focus)' },
      fontSize: { caption: 'var(--text-caption)', body: 'var(--text-body)', 'section-title': 'var(--text-section-title)', 'page-title': 'var(--text-page-title)' },
    },
  },
  plugins: [],
};
