import eslint from "@eslint/js"
import importPlugin from "eslint-plugin-import"
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores(["dist/", "node_modules/"]),

  {
    name: "waha-tui/base",
    files: ["src/**/*.ts"],
    plugins: {
      js: eslint,
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
    },
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript specific
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",

      // Import ordering
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],

      // General
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
])
