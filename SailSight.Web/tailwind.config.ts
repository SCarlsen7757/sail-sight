import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        "sailsight-red": "#FF4500",
        "sailsight-orange": "#FF6A00",

        // Token-driven (CSS vars defined in globals.css)
        "bg-base": "rgb(var(--bg-base) / <alpha-value>)",
        "bg-surface": "rgb(var(--bg-surface) / <alpha-value>)",
        "bg-elevated": "rgb(var(--bg-elevated) / <alpha-value>)",
        "text-primary": "rgb(var(--text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--text-secondary) / <alpha-value>)",
        "text-disabled": "rgb(var(--text-disabled) / <alpha-value>)",
        "border-default": "rgb(var(--border-default) / <alpha-value>)",
        "border-active": "rgb(var(--border-active) / <alpha-value>)",
        "action-primary": "rgb(var(--action-primary) / <alpha-value>)",
        "action-hover": "rgb(var(--action-hover) / <alpha-value>)",

        // Semantic
        success: "#00FF66",
        warning: "#FFCC00",
        error: "#FF3333",
        info: "#00CCFF",

        // Telemetry
        cyan: "#00FFFF",
        magenta: "#FF00FF",
        "neon-green": "#39FF14",
        "bright-yellow": "#FFFF00",
        "deep-blue": "#0000FF",
        "vibrant-purple": "#B200FF",
        amber: "#FFBF00",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
