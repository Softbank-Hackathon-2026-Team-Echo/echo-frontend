import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { initTheme } from '@/hooks/useTheme';
import { meQuery } from '@/lib/api/me';
import { createQueryClient } from '@/lib/api/query-client';
import { initLocale } from '@/lib/i18n';
import { initMonitoring } from '@/lib/monitoring';
import { installStaleChunkReload } from '@/lib/stale-chunk';

/**
 * 예전 목업 빌드가 등록한 MSW 서비스 워커가 브라우저에 남아 있으면 지운다.
 * 남은 워커가 API 요청을 가로채 가짜 응답을 주지 않게 한다 (echo-was#12 댓글)
 */
async function removeMockWorker() {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(
      registrations
        .filter((registration) => registration.active?.scriptURL.endsWith('/mockServiceWorker.js'))
        .map((registration) => registration.unregister()),
    );
  } catch {
    // 서비스 워커를 쓸 수 없는 환경(사생활 보호 모드 등)이면 지울 것도 없다
  }
}

initTheme();
installStaleChunkReload();

const queryClient = createQueryClient();
// 조직 화면의 모든 요청은 /me 의 조직 id 를 기다린다. 언어 파일을 받는 동안 먼저 출발시킨다.
// 소개 화면(/)은 로그인 전 방문자가 401 로 튕기면 안 되므로 조직 주소에서만 부른다
if (window.location.pathname.startsWith('/o/')) void queryClient.prefetchQuery(meQuery);

Promise.all([removeMockWorker(), initLocale()]).then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('#root 요소가 없다');
  createRoot(root).render(
    <StrictMode>
      <App queryClient={queryClient} />
    </StrictMode>,
  );
  // 첫 화면을 그린 뒤 오류 추적 SDK 를 불러온다
  void initMonitoring();
});
