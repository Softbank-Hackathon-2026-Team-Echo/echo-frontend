// MOCK: VITE_USE_MOCKS=true 일 때만 main.tsx 가 동적으로 불러온다 (운영 빌드에 들어가지 않는다)
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
