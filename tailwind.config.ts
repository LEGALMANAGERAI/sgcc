import type { Config } from "tailwindcss";

/**
 * Tailwind v4 config.
 *
 * Los tokens de marca (FlowCase) viven en src/app/globals.css vía `@theme`.
 * Aquí solo se mantienen los colores legacy del codename SGCC para no romper
 * componentes aún migrados. Eliminar cuando la UI interna esté rebrandeada.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Legacy SGCC — TODO eliminar tras rebrand UI interna
        navy: "#0D2340",
        gold: "#B8860B",
        "sgcc-blue": "#1B4F9B",
        "sgcc-green": "#2A9D5C",
        "sgcc-orange": "#E8732A",
        "sgcc-red": "#D42B2B",
      },
    },
  },
  plugins: [],
};

export default config;
