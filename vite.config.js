import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'og-default.png'],
      manifest: {
        name: 'SuChemaFC',
        short_name: 'SuChemaFC',
        description: 'Tu equipo, tus colores, tu pasión. Camisetas de fútbol.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Sin conexión, cualquier pantalla abre el shell de la app (que avisa que no hay red).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/],
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        // Lo que solo usa el admin (escáner QR y entrega): se pide al usarlo.
        globIgnores: ['**/jsQR*', '**/QrScanner*', '**/DeliveryPage*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Fotos de camisas y reseñas (Drive): primero la copia guardada.
            urlPattern: /^https:\/\/lh3\.googleusercontent\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'drive-images',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
