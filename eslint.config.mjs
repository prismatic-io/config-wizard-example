import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Never lint compiled output, and leave the `integrations/` Prismatic workspace to its own
    // tooling — this config lints the Next.js wizard app (app/, components/, hooks/, lib/).
    "**/dist/**",
    "integrations/**",
  ]),
]);

export default eslintConfig;
