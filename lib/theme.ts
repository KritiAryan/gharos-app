// GharOS Design System — single source of truth for inline styles
// Use these when NativeWind class names aren't reliable (layout, fontFamily, etc.)

export const C = {
  primary:      "#7A4520",
  primaryLight: "#A0612D",
  cream:        "#FBF6EF",
  card:         "#FFFDF9",
  accent:       "#F0C98A",
  accentLight:  "#FDF3DC",
  ink:          "#2C1A0E",
  inkMuted:     "#7A5C44",
  inkFaint:     "#B89880",
  border:       "#E8D5B8",
  white:        "#FFFFFF",
} as const;

export const F = {
  heading: "Lora_600SemiBold",
  headingBold: "Lora_700Bold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemiBold: "DMSans_500Medium",
} as const;

export const R = {
  card: 14,
  button: 10,
  pill: 20,
  input: 10,
} as const;
