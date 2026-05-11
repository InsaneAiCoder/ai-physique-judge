/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F172A',
        coal: '#FFFFFF',
        ash: '#F1F5F9',
        mist: '#94A3B8',
        slateText: '#CBD5E1',
        ember: '#EF4444',
        gold: '#F59E0B',
        electric: '#3B82F6',
        violetGlow: '#8B5CF6',
        success: '#22C55E',
      },
      boxShadow: {
        premium: '0 10px 30px rgba(15, 23, 42, 0.08)',
        glow: '0 14px 34px rgba(15, 23, 42, 0.10)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
