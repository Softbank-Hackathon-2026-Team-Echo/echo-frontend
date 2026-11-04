import { fileURLToPath, URL } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 운영 파일은 Cloudflare Pages 가 빌드한다. 그 빌드 환경변수에 업로드 토큰이 있을 때만 소스맵을 만들어
// Sentry 에 올리고 dist 에서 지운다(배포 파일로 원본 코드가 공개되지 않게). 릴리스 이름은 커밋 SHA
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const RELEASE = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: SENTRY_AUTH_TOKEN,
            release: { name: RELEASE },
            sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(RELEASE ?? ''),
  },
  build: {
    sourcemap: SENTRY_AUTH_TOKEN ? 'hidden' : false,
  },
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
    // 글자를 한 자씩 입력하는 테스트가 전체 실행 때 기본 5초를 넘길 수 있다
    testTimeout: 15_000,
    env: { VITE_API_BASE_URL: 'http://api.test' },
  },
});
