import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없다');

createRoot(root).render(
  <StrictMode>
    <h1>EchoPort</h1>
  </StrictMode>,
);
