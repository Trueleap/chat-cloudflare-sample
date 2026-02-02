import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default [
  {
    ignores: ["dist", "node_modules", ".wrangler", "frontend"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error"
    }
  }
]
