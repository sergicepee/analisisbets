import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        card2: "rgb(var(--card2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: { DEFAULT: "#b4f03c", dark: "#86c418" },
        win: "#22c55e",
        loss: "#ef4444",
        warn: "#eab308",
        drawbar: "#1f3a5c",
      },
    },
  },
  plugins: [],
};
export default config;
