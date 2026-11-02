import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { initTheme } from '@/hooks/useTheme';

async function startMocks() {
  // 빌드가 이 분기를 지울 수 있게 환경변수를 여기서 직접 비교한다(다른 모듈 상수는 지우지 못한다).
  // 그래서 VITE_USE_MOCKS 가 없는 운영 번들에는 MSW 가 들어가지 않는다
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
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
