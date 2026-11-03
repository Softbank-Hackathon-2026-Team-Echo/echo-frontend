import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(listener: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

function read() {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/** 움직임 줄이기 설정. 켜져 있으면 지구본 회전·숫자 세기·띠 흐름을 멈춘다 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, read, () => false);
}
