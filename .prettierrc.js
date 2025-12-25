/** @type {import("prettier").Config} */
const config = {
  semi: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 100,
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: [
    "<TYPES>",
    "^node:(.*)$",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "<TYPES>^[.|..|~]",
    "^~/(.*)$",
    "^[../]",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript"],
  importOrderTypeScriptVersion: "5.0.0",
}

export default config
