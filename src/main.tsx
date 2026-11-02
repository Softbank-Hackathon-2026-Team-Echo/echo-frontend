import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { initTheme } from '@/hooks/useTheme';

/**
 * 목업 빌드 때 등록된 MSW 서비스 워커가 브라우저에 남아 있으면 지운다.
 * 운영이 목업에서 실서버로 바뀐 뒤 예전 워커가 남아 혼란을 주지 않게 한다 (echo-was#12 댓글)
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

async function startMocks() {
  // 빌드가 이 분기를 지울 수 있게 환경변수를 여기서 직접 비교한다(다른 모듈 상수는 지우지 못한다).
  // 그래서 VITE_USE_MOCKS 가 없는 운영 번들에는 MSW 가 들어가지 않는다
  if (import.meta.env.VITE_USE_MOCKS !== 'true') {
    await removeMockWorker();
    return;
  }
  const { worker } = await import('@/mocks/browser');
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
}

initTheme();

startMocks().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('#root 요소가 없다');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
