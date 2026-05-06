import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Brand palette — soft orange, warm, professional ===
        canvas: "#FAFAF9",        // page background (warm off-white)
        ink: "#1A1614",           // primary text (warm near-black)
        mute: "#6B6660",          // secondary text (warm gray)
        accent: {
          DEFAULT: "#E8743C",     // soft orange — primary brand
          dark: "#C25E2C",        // hover / pressed
          light: "#F4A87A",       // peach light
          glow: "#FFB585",        // very light peachy glow
        },
        // === Secondary cool palette — slate blue for balance & depth ===
        blue: {
          DEFAULT: "#3D5A80",     // slate blue — secondary brand
          dark: "#293F5C",        // deep slate
          light: "#7B9AC0",       // soft slate
          glow: "#B8CDE3",        // very light blue glow
        },
        soft: {
          warm: "#FFF3EA",        // peach cream — "good" column / gentle fills
          cool: "#EEF2F7",        // soft sky-blue — "before" column / cool surfaces
          gray: "#F1F1EE",        // neutral panel
          ink: "#15110F",         // warm dark surface
          inkBlue: "#15202F",     // blue dark surface (demo placeholder, mockup)
        },
      },
      fontFamily: {
        // Wired up via next/font in app/layout.tsx through CSS variables
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26, 22, 20, 0.04), 0 4px 12px rgba(26, 22, 20, 0.05)",
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
