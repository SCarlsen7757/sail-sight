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
  // Playwright fixtures call a `use` callback that is not a React hook.
  { files: ["e2e/**"], rules: { "react-hooks/rules-of-hooks": "off" } },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "src/lib/api-types.ts", "playwright-report/**", "test-results/**"]),
]);
