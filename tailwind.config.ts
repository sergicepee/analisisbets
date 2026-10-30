import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        list: ["var(--font-list)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        card2: "rgb(var(--card2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        league: { strip: "rgb(var(--league-strip) / <alpha-value>)" },
        brand: { DEFAULT: "#adc9a3", dark: "#93b58a" },
        win: "#adc9a3",
        loss: "#e34b57",
        chartHit: "#adc9a3",
        warn: "#eab308",
        drawbar: "#68737d",
        statGreen: "#39ab6b",
        statOrange: "#db9838",
        statRed: "#c74246",
      },
    },
  },
  plugins: [],
};
export default config;
