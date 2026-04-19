/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // GharOS design system
        primary:    "#7A4520",   // dark brown — buttons, active states
        cream:      "#FBF6EF",   // warm cream — screen backgrounds
        card:       "#FFFDF9",   // card surfaces
        accent:     "#F0C98A",   // golden — highlights, tags
        ink:        "#2C1A0E",   // primary text
        border:     "#E8D5B8",   // card borders, dividers
        // Secondary shades
        "primary-light": "#A0612D",
        "accent-light":  "#FDF3DC",
        "ink-muted":     "#7A5C44",
      },
    },
  },
  plugins: [],
};
