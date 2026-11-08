// 배포하면 파일 이름이 바뀌고 옛 파일은 사라진다. 배포 전에 연 탭이 다음 화면 코드를 받다 실패하면 새로고침한다
const STORAGE_KEY = 'echoport.stale-chunk-reload';
/** 이 시간 안에 또 실패하면 진짜 오류다. 새로고침을 반복하지 않고 오류 화면에 맡긴다 */
const RETRY_WINDOW_MS = 10_000;

function lastReload(): number {
  try {
    return Number(window.sessionStorage.getItem(STORAGE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function rememberReload(now: number) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // 저장하지 못해도 새로고침은 한다
  }
}

export function reloadOnceForStaleChunk(reload: () => void, now = Date.now()): boolean {
  if (now - lastReload() < RETRY_WINDOW_MS) return false;
  rememberReload(now);
  reload();
  return true;
}

// 브라우저마다 지연 로드 실패 문구가 다르다(Chrome·Firefox·Safari, Vite CSS 미리 받기)
const STALE_CHUNK_MESSAGE =
  /dynamically imported module|Importing a module script failed|Failed to load module script|Unable to preload CSS/i;

/** 배포로 사라진 화면 코드를 받다 난 오류인지. 운영은 없는 파일 대신 index.html 을 줘서 이렇게 실패한다 */
export function isStaleChunkError(error: unknown): boolean {
  return error instanceof Error && STALE_CHUNK_MESSAGE.test(error.message);
}

export function reloadPage() {
  window.location.reload();
}

/** Vite 가 지연 로드 실패를 알리는 이벤트다 */
export function installStaleChunkReload() {
  window.addEventListener('vite:preloadError', () => {
    reloadOnceForStaleChunk(() => window.location.reload());
  });
}
