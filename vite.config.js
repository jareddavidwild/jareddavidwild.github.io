const { defineConfig } = require('vite')

// Try to require the plugin; if not installed yet, fallback to null so build won't crash.
let viteImagemin = null
try {
  // plugin may export default or the function directly
  const mod = require('vite-plugin-imagemin')
  viteImagemin = mod && (mod.default || mod)
} catch (e) {
  viteImagemin = null
}

// Small build config to reduce chunk warnings and split vendor (three) into its own chunk
module.exports = defineConfig({
  // When deploying to GitHub Pages under a project path (example:
  // https://<owner>.github.io/<repo>/) set the base to the repository
  // name so built asset URLs are correct. This repo publishes under
  // /jareddavidwild.github.io/ so we'll set that as the base.
  base: '/jareddavidwild.github.io/',
  plugins: viteImagemin
    ? [
        viteImagemin({
          gifsicle: { optimizationLevel: 3 },
          optipng: { optimizationLevel: 5 },
          mozjpeg: { quality: 75 },
          pngquant: { quality: [0.6, 0.8] },
          svgo: { multipass: true },
          webp: { quality: 75 }
        })
      ]
    : [],
  build: {
    // increase warning limit because we intentionally have large image assets
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'three-vendor'
            return 'vendor'
          }
        }
      }
    }
  }
})
