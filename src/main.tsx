import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme } from '@/hooks/useTheme';
import TokensPage from '@/pages/dev/TokensPage';

initTheme();

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없다');

createRoot(root).render(
  <StrictMode>
    <TokensPage />
  </StrictMode>,
);
