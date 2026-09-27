// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const noSwitch = {
  selector: 'SwitchStatement',
  message: 'No switch: use a lookup table (operator registry, route map).',
};

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'jest.config.js'] },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Table-driven code: no switch over operators, factors, bands or routes.
    files: ['src/engine/**/*.ts', 'src/kb/**/*.ts', 'src/handler.ts'],
    rules: { 'no-restricted-syntax': ['error', noSwitch] },
  },
  {
    // No scoring numbers in the engine: every number lives in risk-kb.json.
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/*.spec.ts', 'src/engine/test-kb.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': ['error', { ignore: [0, 1], ignoreTypeIndexes: true }],
    },
  },
);
