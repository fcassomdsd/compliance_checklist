import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import json from "@eslint/json";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,vue}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  // eslint-plugin-vue's flat/essential array includes sub-configs with no
  // `files` restriction of their own (e.g. the one carrying
  // vue/multi-word-component-names), so without scoping them here their
  // rules apply to every linted file, including the **/*.json block below —
  // vue-eslint-parser has no script-setup context for a JSON file and
  // crashes. Restrict every sub-config to *.vue explicitly.
  ...pluginVue.configs["flat/essential"].map((config) => ({
    ...config,
    files: config.files || ["**/*.vue"],
  })),
  { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
  // electron/** is main-process/preload code (Node, not browser) — without
  // this, `process`/`require`/etc. trip no-undef. Merges with (doesn't
  // replace) the browser globals from the base block above.
  { files: ["electron/**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.node } },
]);
