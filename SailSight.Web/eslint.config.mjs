import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Legacy typing and effect patterns remain visible during this upgrade.
  { rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/set-state-in-effect": "warn",
  } },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/lib/api-types.ts"]),
]);
