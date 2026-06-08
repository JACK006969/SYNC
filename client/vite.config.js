import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ✅ FIX 3: This file is required for @vitejs/plugin-react to transform JSX.
// Place this file at: client/vite.config.js
export default defineConfig({
  plugins: [react()],
})
