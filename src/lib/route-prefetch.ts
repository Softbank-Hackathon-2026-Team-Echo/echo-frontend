// 다음 화면 코드 미리 받기. 메뉴에 마우스를 올리거나 포커스하면 그 경로의 지연 로드 청크를 먼저 받는다.
// 라우터 표는 router.tsx 가 넘긴다(여기서 라우터를 import 하면 AppShell ↔ router 가 서로 불러 순환한다)
import { matchRoutes, type RouteObject } from 'react-router';

let routes: RouteObject[] = [];
const requested = new Set<string>();

export function registerPrefetchRoutes(next: RouteObject[]): void {
  routes = next;
}

/** 경로(`/o/acme/services`)에 걸리는 화면들의 lazy 를 미리 부른다. 같은 경로는 한 번만 */
export function prefetchRoute(pathname: string): void {
  if (requested.has(pathname)) return;
  requested.add(pathname);
  for (const { route } of matchRoutes(routes, pathname) ?? []) {
    // import() 는 모듈 캐시를 쓰므로 실제로 들어갈 때 라우터가 다시 불러도 내려받지 않는다.
    // 미리 받기가 실패해도 화면 이동 때 다시 시도하므로 여기서는 버린다
    if (typeof route.lazy === 'function') route.lazy().catch(() => undefined);
  }
}
