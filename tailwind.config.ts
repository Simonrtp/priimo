import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Brand palette — soft orange + slate blue (unchanged) ===
        canvas: "#FAFAF9",
        // Semantic text (WCAG-aligned grays) — use with text-* utilities
        ink: "#111827", // gray-900 — primary text / headlines (legacy alias)
        mute: "#4B5563", // gray-600 — secondary copy (legacy alias)
        accent: {
          DEFAULT: "#E8743C",
          dark: "#C25E2C",
          light: "#F4A87A",
          glow: "#FFB585",
        },
        blue: {
          DEFAULT: "#3D5A80",
          dark: "#293F5C",
          light: "#7B9AC0",
          glow: "#B8CDE3",
        },
        soft: {
          warm: "#FFF3EA",
          cool: "#EEF2F7",
          gray: "#F1F1EE",
          ink: "#15110F",
          inkBlue: "#15202F",
        },

        // === PRIIMO Design System — tokens clay (PRIIMO_DESIGN_SYSTEM.md §1.6) ===
        // Additifs : n'écrasent pas la palette de marque orange/bleu ci-dessus.
        bg: { base: "var(--bg-base)", subtle: "var(--bg-subtle)" },
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        primary: {
          50: "var(--primary-50)",
          100: "var(--primary-100)",
          200: "var(--primary-200)",
          400: "var(--primary-400)",
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
        },
        violet: { 400: "var(--violet-400)", 500: "var(--violet-500)" },
        text: {
          strong: "var(--text-strong)",
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        score: {
          high: "var(--score-high)",
          good: "var(--score-good)",
          mid: "var(--score-mid)",
          low: "var(--score-low)",
        },
      },
      fontFamily: {
        // Corps (Inter) → --font-body ; Display (Plus Jakarta Sans) → --font-display ;
        // Mono (JetBrains Mono) → --font-mono. Chargés via next/font (layout.tsx).
        sans: [
          "var(--font-body)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-body)",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        brand: ["var(--font-brand)", "Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(17, 24, 39, 0.04), 0 4px 12px rgba(17, 24, 39, 0.05)",
        cta: "0 6px 20px rgba(232, 116, 60, 0.25)",
        ctaHover: "0 10px 28px rgba(232, 116, 60, 0.35)",
        // === Ombres clay (PRIIMO_DESIGN_SYSTEM.md §4.3) ===
        "clay-sm": "var(--clay-sm)",
        clay: "var(--clay)",
        "clay-lg": "var(--clay-lg)",
        "clay-pressed": "var(--clay-pressed)",
        "clay-inset": "var(--clay-inset)",
        "clay-primary": "var(--clay-primary)",
      },
      borderRadius: {
        // §3 — rayons clay généreux
        clay: "16px",
        "clay-lg": "24px",
        "clay-xl": "32px",
      },
      transitionTimingFunction: {
        // §7.1 — courbes signature
        clay: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        soft: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        floatA: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(40px, -30px) scale(1.08)" },
        },
        floatB: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-30px, 25px) scale(0.95)" },
        },
        floatC: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(20px, 15px)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease-out",
        spin: "spin 0.8s linear infinite",
        floatA: "floatA 14s ease-in-out infinite",
        floatB: "floatB 18s ease-in-out infinite",
        floatC: "floatC 22s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
