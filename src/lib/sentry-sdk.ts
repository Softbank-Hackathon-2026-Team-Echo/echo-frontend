// monitoring.ts 가 나중에 불러오는 Sentry 묶음. 쓰는 것만 이름으로 꺼내야 나머지가 번들에서 빠진다
export {
  addIntegration,
  browserTracingIntegration,
  captureException,
  init,
  setTag,
  setUser,
  withScope,
} from '@sentry/react';
