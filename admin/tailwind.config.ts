import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:    "#7A4520",
          bg:         "#FBF6EF",
          card:       "#FFFDF9",
          accent:     "#F0C98A",
          text:       "#2C1A0E",
          border:     "#E8D5B8",
          sidebar:    "#1C0F06",
          "sidebar-hover": "#2E1A0E",
          muted:      "#9A7B65",
        },
      },
      fontFamily: {
        sans:  ["DM Sans", "sans-serif"],
        serif: ["Lora", "serif"],
      },
      borderRadius: {
        card:   "14px",
        button: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
