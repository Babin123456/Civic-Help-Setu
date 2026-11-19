import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { findSecretLikeVars, formatFindings } from './scripts/envGuard.js'

export default defineConfig(({ mode }) => {
  const findings = findSecretLikeVars(loadEnv(mode, '.', 'VITE_'))
  if (findings.length > 0) throw new Error(formatFindings(findings))

  return {
    plugins: [react()],
    test: {
      exclude: [...configDefaults.exclude, 'firebase/emulator/**', 'Civic-Help-Setu/**'],
    },
    build: {
      minify: 'esbuild',
      esbuild: {
        drop: ['console', 'debugger'],
        pure: ['console.log'],
      }
    }
  }
})
