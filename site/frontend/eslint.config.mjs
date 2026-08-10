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
    // Generated, not ours: scripts/build-wasm.mjs copies wasm_exec.js verbatim
    // out of the Go toolchain on every prebuild. It is untracked, it is rewritten
    // whenever the Go version moves, and its style is Go's business — linting it
    // only ever produces failures nobody can fix here.
    "public/wasm_exec.js",
  ]),
]);

export default eslintConfig;
