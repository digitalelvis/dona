/**
 * Prettier configuration — explicit on every option used by the project,
 * so that defaults changing across Prettier versions do not silently
 * reformat the codebase.
 *
 * @type {import("prettier").Config}
 */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  embeddedLanguageFormatting: "auto",
  proseWrap: "preserve",
  singleAttributePerLine: false,
};
