import { vi } from 'vitest';

/** 실제 구독 훅을 거쳐 실행 중 OS 설정 변경까지 시험한다 */
export function mockReducedMotion(initial = false) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  return (next: boolean) => {
    matches = next;
    for (const listener of listeners) listener();
  };
}
