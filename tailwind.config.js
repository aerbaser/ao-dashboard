/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Design tokens from Leo — ~/.openclaw/workspace-leo/projects/ao-dashboard/design-tokens.json
      // Архимед: import and apply in src/index.css
    },
  },
  plugins: [],
}
