import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.SITE_BASE || '/',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-vendor'
        }
      }
    }
  }
})
