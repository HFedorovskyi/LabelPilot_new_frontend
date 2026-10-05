import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import plugin from "tailwindcss/plugin";

// Design tokens (light by default, `.dark` on <html> switches) live in app/globals.css
// as RGB triplets; `lp-*` classes are what redesigned screens use.
const token = (name: string) => `rgb(var(--lp-${name}) / <alpha-value>)`;
const TOKENS = [
  "bg", "surface", "raised", "line", "line-2", "ink", "ink-2", "ink-3",
  "ok", "ok-bg", "warn", "warn-bg", "bad", "bad-bg", "off", "off-bg",
  "coral", "coral-bg", "sky", "accent", "accent-bg", "accent-ink", "bar",
];

// Screens not redesigned yet were written for a dark UI (white text, white/5 washes,
// 200–400 accent shades). In the light theme `white` becomes ink, `black` becomes
// paper and these palettes mirror (300 ↔ 700, 50 ↔ 950), so those screens stay
// readable until they are redesigned. In the dark theme every value is stock Tailwind.
const MIRRORED = [
  "red", "amber", "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "fuchsia", "pink", "rose", "neutral",
] as const;
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

const triplet = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const palette = (name: string) =>
  Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--pal-${name}-${shade}) / <alpha-value>)`]));

const legacyVariables = plugin(({ addBase }) => {
  const light: Record<string, string> = { "--lg-white": "10 14 22", "--lg-black": "255 255 255" };
  const dark: Record<string, string> = { "--lg-white": "255 255 255", "--lg-black": "0 0 0" };
  for (const name of MIRRORED) {
    const scale = colors[name] as Record<string, string>;
    SHADES.forEach((shade, i) => {
      dark[`--pal-${name}-${shade}`] = triplet(scale[shade]);
      light[`--pal-${name}-${shade}`] = triplet(scale[SHADES[SHADES.length - 1 - i]]);
    });
  }
  addBase({ ":root": light, ".dark": dark });
});

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        white: "rgb(var(--lg-white) / <alpha-value>)",
        black: "rgb(var(--lg-black) / <alpha-value>)",
        ...Object.fromEntries(MIRRORED.map((name) => [name, palette(name)])),
        lp: Object.fromEntries(TOKENS.map((name) => [name, token(name)])),
      },
      fontFamily: {
        sans: ['"Manrope Variable"', "Manrope", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [legacyVariables],
};
export default config;
