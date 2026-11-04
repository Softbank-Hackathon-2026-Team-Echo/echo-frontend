import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { reportError } from '@/lib/monitoring';
import { EmptyState } from './EmptyState';

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={t('This screen hit an error')}
      description={error instanceof Error ? error.message : t('Unexpected error')}
      action={
        <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
          {t('Try again')}
        </Button>
      }
    />
  );
}

/**
 * 화면 하나에서 난 렌더 오류가 앱 전체를 하얗게 만들지 않게 막는다 (ADR 11/2 React Error Boundary).
 * 주소가 바뀌면 다시 그려 본다
 */
export function ScreenErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={Fallback}
      resetKeys={[pathname]}
      onError={(error) => reportError(error, { tags: { boundary: 'screen', path: pathname } })}
    >
      {children}
    </ErrorBoundary>
  );
}
