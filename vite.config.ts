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
        // Leituras (GET) na API do Supabase ficam em cache para funcionar
        // offline; escritas (POST/RPC) não passam por aqui e continuam
        // exigindo conexão — a UI já bloqueia essas ações quando offline.
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.url.includes('.supabase.co') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-reads',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Garante que os testes rodem mesmo sem `.env.local` (caso do CI, que não
    // tem esses secrets configurados). O valor real nunca é usado nos testes
    // porque eles injetam InMemoryRepository/AppShell diretamente — mas o
    // módulo supabaseClient.ts roda `createClient()` no escopo do módulo e
    // lança se a URL for undefined.
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    },
  },
});
