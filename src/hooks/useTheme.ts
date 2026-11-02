import { useSyncExternalStore } from 'react';

export const THEMES = ['light', 'dark', 'projector'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'echoport.theme';
const listeners = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

// 사생활 보호 모드·저장소 차단에서는 접근만으로 예외가 나므로 실패하면 라이트로 둔다
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

let currentTheme: Theme = typeof window === 'undefined' ? 'light' : readStoredTheme();

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** 첫 렌더 전에 불러 깜빡임 없이 저장된 테마를 적용한다 */
export function initTheme() {
  applyTheme(currentTheme);
}

export function setTheme(theme: Theme) {
  currentTheme = theme;
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장하지 못해도 이번 탭에서는 바뀐 테마로 동작한다
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => currentTheme,
    () => 'light' as Theme,
  );
  return { theme, setTheme, themes: THEMES };
}
