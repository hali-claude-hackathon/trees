import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The workbox glob below already picks up the icons and the manifest;
      // letting the plugin add them again yields duplicate precache entries.
      includeManifestIcons: false,
      manifest: {
        name: 'HRM Fallen Tree Reporter',
        short_name: 'Fallen Trees',
        description:
          'Report a fallen tree in Halifax Regional Municipality. Reports are stored on your device.',
        theme_color: '#155724',
        background_color: '#f4f6f4',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // `manifest.webmanifest` is added to the precache by the plugin itself,
        // so it is deliberately not in this glob.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // Precache the app shell and serve it for any navigation so a cold,
        // offline launch still renders the UI.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
