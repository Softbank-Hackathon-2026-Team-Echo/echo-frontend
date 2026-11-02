import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { EmptyState } from './EmptyState';

type ErrorStateProps = { error: unknown; onRetry?: () => void };

/** 조회 실패 공통 화면. 502·503·네트워크 오류는 다시 시도 버튼을 준다 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const requestId = isApiError(error) ? error.requestId : null;
  const canRetry = !isApiError(error) || error.status === 0 || error.status >= 500;
  return (
    <EmptyState
      icon={CircleAlert}
      title="Couldn't load this"
      description={[describeApiError(error), requestId && `Request ID ${requestId}`]
        .filter(Boolean)
        .join(' · ')}
      action={
        canRetry && onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}
