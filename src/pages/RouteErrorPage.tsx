import { CircleAlert } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

/** 라우터 밖(앱 껍데기 포함)에서 난 오류. 껍데기 안 화면 오류는 ScreenErrorBoundary 가 먼저 잡는다 */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error';
  return (
    <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
      <EmptyState
        className="w-full"
        icon={CircleAlert}
        title="Something went wrong"
        description={message}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">Go home</Link>
          </Button>
        }
      />
    </main>
  );
}
