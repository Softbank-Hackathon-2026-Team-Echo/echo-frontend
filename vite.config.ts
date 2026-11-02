import { rm } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// 목업을 쓰지 않는 빌드(운영)에서는 public/ 에서 복사된 MSW 워커 파일을 지운다
function dropMockWorker(useMocks: boolean): Plugin {
  return {
    name: 'drop-mock-worker',
    apply: 'build',
    async writeBundle(options) {
      if (useMocks || !options.dir) return;
      await rm(`${options.dir}/mockServiceWorker.js`, { force: true });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    dropMockWorker(loadEnv(mode, process.cwd(), 'VITE_').VITE_USE_MOCKS === 'true'),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // echo-was 허용 Origin 목록에 http://localhost:5173 으로 등록했다 (echo-was #12)
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { VITE_API_BASE_URL: 'http://api.test', VITE_USE_MOCKS: 'false' },
  },
}));
