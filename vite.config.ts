/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: "L'AUREA Estoque",
        short_name: "L'AUREA",
        description:
          "Controle de estoque e produção da L'AUREA Aromas: velas artesanais, insumos e relatório mensal.",
        theme_color: '#17150F',
        background_color: '#FCFAF6',
        display: 'standalone',
        start_url: '/',
        // TODO: substituir pelo monograma oficial da marca (L' dourado sobre
        // grafite) assim que os arquivos forem fornecidos pelo dono do repo.
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
