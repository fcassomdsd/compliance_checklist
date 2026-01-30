/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parser: "vue-eslint-parser",
  parserOptions: {
    parser: "@babel/eslint-parser",
    ecmaVersion: 2022,
    sourceType: "module",
    requireConfigFile: false,
  },
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-recommended",
    "plugin:prettier/recommended",
  ],
  rules: {
    // --- Code style ---
    "semi": ["error", "never"],
    "quotes": ["error", "single"],
    "no-trailing-spaces": "error",
    "no-multiple-empty-lines": ["error", { max: 1 }],
    "eol-last": ["error", "always"],

    // --- Vue rules ---
    "vue/html-indent": ["error", 2],
    "vue/max-attributes-per-line": [
      "error",
      {
        singleline: { max: 3 },
        multiline: { max: 1 },
      },
    ],
    "vue/singleline-html-element-content-newline": "off",
    "vue/multiline-html-element-content-newline": "off",
    "vue/html-closing-bracket-newline": "off",
    "vue/no-unused-components": "warn",

    // --- Best practices ---
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "prefer-const": "error",
    "no-var": "error",
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    "coverage/",
  ],
}

