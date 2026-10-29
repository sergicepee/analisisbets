import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#080b0d",
        card: "#10151a",
        card2: "#151c22",
        line: "#212b34",
        muted: "#8896a3",
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
