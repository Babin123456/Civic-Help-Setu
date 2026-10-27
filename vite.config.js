import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { findSecretLikeVars, formatFindings } from './scripts/envGuard.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Everything prefixed VITE_ ends up in the public bundle, so stop the build
  // if one of them looks like a server secret.
  const findings = findSecretLikeVars(loadEnv(mode, '.', 'VITE_'))
  if (findings.length > 0) throw new Error(formatFindings(findings))

  return { plugins: [react()] }
})
