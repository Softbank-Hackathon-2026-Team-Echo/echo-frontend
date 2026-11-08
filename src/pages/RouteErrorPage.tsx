import { CircleAlert, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { reportError } from '@/lib/monitoring';
import { isStaleChunkError, reloadOnceForStaleChunk, reloadPage } from '@/lib/stale-chunk';

/** 라우터 밖(앱 껍데기 포함)에서 난 오류. 껍데기 안 화면 오류는 ScreenErrorBoundary 가 먼저 잡는다 */
export function RouteErrorPage() {
  const error = useRouteError();
  // 배포 전에 연 탭이 사라진 화면 코드를 받다 실패한 것은 고장이 아니다. 새로고침하면 새 버전으로 열린다
  const stale = isStaleChunkError(error);
  // 없는 주소(404 응답)는 오류가 아니다
  useEffect(() => {
    if (stale) {
      reloadOnceForStaleChunk(reloadPage);
      return;
    }
    if (!isRouteErrorResponse(error)) reportError(error, { tags: { boundary: 'route' } });
  }, [error, stale]);

  if (stale) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
        <EmptyState
          className="w-full"
          icon={RefreshCw}
          title={t('A new version was deployed')}
          description={t('Reloading to open this screen in the new version.')}
          action={
            <Button variant="outline" size="sm" onClick={reloadPage}>
              {t('Reload')}
            </Button>
          }
        />
      </main>
    );
  }

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : t('Unexpected error');
  return (
    <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
      <EmptyState
        className="w-full"
        icon={CircleAlert}
        title={t('Something went wrong')}
        description={message}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">{t('Go home')}</Link>
          </Button>
        }
      />
    </main>
  );
}
