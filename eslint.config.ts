import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default defineConfig([
  {
    ignores: [
      'eslint.config.ts',
      'src/generated/**',
      'dist/**',
    ],
  },
  {
    files: ['**/*.{js,ts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  tseslint.configs.strictTypeChecked,
  eslintPluginPrettierRecommended,
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
]);
