import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0D2340",
        gold: "#B8860B",
      },
    },
  },
  plugins: [],
};

export default config;
