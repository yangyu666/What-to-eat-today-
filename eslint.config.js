const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['node_modules/**', 'miniprogram_npm/**', 'cloudfunctions/**/node_modules/**']
  },
  {
    files: ['miniprogram/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json'
      },
      globals: {
        App: 'readonly',
        Page: 'readonly',
        wx: 'readonly',
        getApp: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  }
];
