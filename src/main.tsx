import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { initTheme } from '@/hooks/useTheme';

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

removeMockWorker().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('#root 요소가 없다');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
