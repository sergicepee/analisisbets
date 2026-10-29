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
        brand: { DEFAULT: "#ff3347", dark: "#d51f32" },
        win: "#ff3347",
        loss: "#a92536",
        warn: "#eab308",
        drawbar: "#68737d",
      },
    },
  },
  plugins: [],
};
export default config;
