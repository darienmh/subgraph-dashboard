import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The Graph-ish palette
        brand: { DEFAULT: "#6f4cff", soft: "#8b6cff", dark: "#4f35c9" },
        ink: { 900: "#0b0d17", 800: "#11131f", 700: "#1a1d2e", 600: "#262a3d" },
      },
    },
  },
  plugins: [],
};

export default config;
