import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './', // relative paths: works on GitHub Pages under /weavesmith/
  plugins: [
    react(),
    /*
     * Looms are not near wifi. The whole point of the service worker is that
     * the app opens at the loom with no network at all — everything this app
     * needs is static, and the pattern already lives in localStorage.
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'WeaveSmith',
        short_name: 'WeaveSmith',
        description: 'A pattern designer for tablet weaving.',
        display: 'standalone',
        // The app's own dyed-wool ground, so the splash and the status bar
        // match the board rather than flashing white before it paints.
        theme_color: '#14110E',
        background_color: '#14110E',
        // Relative, like `base` above: the app is served from a subpath on
        // GitHub Pages, and an absolute '/' would scope the manifest to the
        // domain root where nothing lives.
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            // Lets Android crop to its own mask instead of framing the
            // whole square inside a circle.
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The build is a handful of files and no runtime network calls, so
        // precaching everything is both cheap and the only way "works
        // offline after one visit" can be true.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
