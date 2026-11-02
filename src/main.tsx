import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { initTheme } from '@/hooks/useTheme';
import { USE_MOCKS } from '@/lib/env';

async function startMocks() {
  if (!USE_MOCKS) return;
  // 동적 import 라 VITE_USE_MOCKS 가 없으면 운영 번들에 MSW 가 들어가지 않는다
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
