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
      },
      fontFamily: {
        // Single stack: Inter via next/font → --font-sans (layout.tsx)
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(17, 24, 39, 0.04), 0 4px 12px rgba(17, 24, 39, 0.05)",
        cta: "0 6px 20px rgba(232, 116, 60, 0.25)",
        ctaHover: "0 10px 28px rgba(232, 116, 60, 0.35)",
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
