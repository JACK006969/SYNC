import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.', // Tell Vite that client folder is the root
  base: '/',
  build: {
    outDir: '../server/dist', // Build output goes to server/dist
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true }
    }
  }
})
