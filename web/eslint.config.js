import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // android/ is the generated Capacitor native project (Kotlin/Java/
  // Gradle, plus its own build output) -- not JS/TS this config's
  // parserOptions.projectService has any tsconfig for, and not code this
  // project's own conventions apply to.
  { ignores: ['dist', 'android'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  // Vercel serverless functions (api/_lib/r2.ts and friends) run in
  // Node, not the browser -- `process`, `Buffer`, etc. are real globals
  // here, not typos, and there's no React to lint against.
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
