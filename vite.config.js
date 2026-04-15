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
    // Compute a sensible `base` for different environments:
    // - If SITE_BASE is set (recommended for CI), use it.
    // - If running in GitHub Actions, derive the repo name from GITHUB_REPOSITORY
    //   and use `/repo-name/` (this matches project-pages deployments).
    // - Otherwise default to '/' for local dev and user/org pages.
    base: (function () {
      // Allow explicit override (recommended for CI): SITE_BASE should include leading and trailing slash, e.g. '/my-repo/' or '/'.
      if (process.env.SITE_BASE) return process.env.SITE_BASE;

      // If running in GitHub Actions, derive a sensible base from GITHUB_REPOSITORY.
      // For user/org pages the repo name is <owner>.github.io and should be served at '/'
      // For project pages use '/repo-name/'.
      if (process.env.CI && process.env.GITHUB_REPOSITORY) {
        const parts = process.env.GITHUB_REPOSITORY.split('/');
        const repo = parts[1] || '';
        // If the repository name ends with .github.io it's a user/org page and should be served at '/'
        if (repo.toLowerCase().endsWith('.github.io')) {
          return '/';
        }
        return `/${repo}/`;
      }

      // Default to root for local dev and for sites already hosted at the domain root.
      return '/';
    })(),
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
