import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  { files: ['src/**/*.{ts,tsx}', '*.ts'], extends: [js.configs.recommended, ...tseslint.configs.recommended], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } }, rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-constant-condition': 'off', '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-empty-object-type': 'off', '@typescript-eslint/no-non-null-assertion': 'off' } },
);
