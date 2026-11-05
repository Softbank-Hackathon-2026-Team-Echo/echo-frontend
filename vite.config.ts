import { fileURLToPath, URL } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// 운영 파일은 Cloudflare Pages 가 빌드한다. 그 빌드 환경변수에 업로드 토큰이 있을 때만 소스맵을 만들어
// Sentry 에 올리고 dist 에서 지운다(배포 파일로 원본 코드가 공개되지 않게). 릴리스 이름은 커밋 SHA
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const RELEASE = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;

/**
 * 대시보드 주소로 바로 들어오면 첫 코드를 받는 동안 /me 와 대시보드 코드를 같이 받기 시작한다.
 * 파일 이름에 해시가 붙어 빌드 뒤에야 알 수 있어서 HTML 에 넣는다. 소개 · 로그인 화면은 받지 않는다
 */
function dashboardPreload(): Plugin {
  let apiBaseUrl = '';
  return {
    name: 'echo-dashboard-preload',
    apply: 'build',
    configResolved(config) {
      apiBaseUrl = String(config.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const chunks = Object.values(context.bundle ?? {}).filter((item) => item.type === 'chunk');
        const dashboard = chunks.find((chunk) => chunk.name === 'DashboardPage');
        if (!dashboard) return [];
        const files = new Set<string>();
        const visit = (fileName: string) => {
          if (files.has(fileName)) return;
          files.add(fileName);
          for (const next of chunks.find((chunk) => chunk.fileName === fileName)?.imports ?? []) {
            visit(next);
          }
        };
        visit(dashboard.fileName);
        const script = `if(/^\\/o\\/[^/]+\\/?$/.test(location.pathname)){
const add=(rel,href,more)=>{const l=document.createElement('link');l.rel=rel;l.href=href;Object.assign(l,more);document.head.append(l)};
add('preload',${JSON.stringify(`${apiBaseUrl}/api/v1/me`)},{as:'fetch',crossOrigin:'use-credentials'});
for(const f of ${JSON.stringify([...files])})add('modulepreload','/'+f);
}`;
        return [{ tag: 'script', children: script, injectTo: 'head-prepend' }];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dashboardPreload(),
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
