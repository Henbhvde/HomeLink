import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  { files: ['src/**/*.ts', 'prisma/**/*.ts'], extends: [js.configs.recommended, ...tseslint.configs.recommended], rules: { 'no-undef': 'off', 'no-unused-vars': 'off', '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-empty-object-type': 'off', '@typescript-eslint/no-non-null-assertion': 'off' } },
);
