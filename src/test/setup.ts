import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw-server';

// 전체 실행이 몰릴 때 화면을 기다리는 1초 기본값이 모자라 가끔 실패했다
configure({ asyncUtilTimeout: 3000 });

// jsdom 에 없는 브라우저 API. Radix 팝오버·툴팁이 크기를 잴 때 쓴다
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
