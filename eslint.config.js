import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'android/app/build',
    'node_modules',
    'coverage',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // react-three-fiber's useFrame is a per-frame imperative escape hatch,
    // the same category as useEffect: mutating useMemo'd Three.js objects
    // (materials, geometries) inside it is the standard, required R3F
    // pattern for driving 60fps animation without React re-renders. The
    // generic react-hooks/immutability rule doesn't recognize useFrame as
    // an escape hatch, so it's scoped off for this cinematic scene tree only.
    files: ['src/components/cinematic-hero/**/*.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
])
