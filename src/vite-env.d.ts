/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Sentry 프로젝트 DSN. 없으면 오류 추적을 켜지 않는다 */
  readonly VITE_SENTRY_DSN?: string;
  /** 릴리스 이름(커밋 SHA). vite.config 가 Cloudflare Pages 빌드 값으로 채운다 */
  readonly VITE_SENTRY_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
