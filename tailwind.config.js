/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper, #EFF2F1)",
        card: "var(--card, #FFFFFF)",
        ink: {
          DEFAULT: "var(--ink, #14181B)",
          soft: "var(--ink-soft, #3B4643)",
          faint: "var(--ink-faint, #4E5A56)",
        },
        line: {
          DEFAULT: "var(--line, #DEE4E2)",
          soft: "var(--line-soft, #EAEEEC)",
        },
        brand: {
          DEFAULT: "var(--brand, #0B6E63)",
          dark: "var(--brand-dark, #084F47)",
          tint: "var(--brand-tint, #E2EFEC)",
        },
        amber: {
          DEFAULT: "var(--amber, #B9762A)",
          tint: "var(--amber-tint, #F7EADA)",
          ink: "var(--amber-ink, #7A4E17)",
        },
        red: {
          DEFAULT: "var(--red, #B3261E)",
          tint: "var(--red-tint, #F7E1DF)",
        },
        sidebar: {
          bg: "var(--sidebar-bg, #0F1E1B)",
          ink: "var(--sidebar-ink, #B7C6C1)",
          active: "var(--sidebar-active, #17332C)",
          white: "var(--sidebar-white, #F3F6F5)",
        },
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}
