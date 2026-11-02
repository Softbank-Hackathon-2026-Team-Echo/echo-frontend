import { toast } from 'sonner';
import { describeApiError, isApiError } from './errors';

/** 오류 토스트. 요청 ID 가 있으면 함께 보여 주고 복사할 수 있게 한다 */
export function notifyApiError(error: unknown) {
  const requestId = isApiError(error) ? error.requestId : null;
  toast.error(describeApiError(error), {
    description: requestId ? `Request ID ${requestId}` : undefined,
    action: requestId
      ? {
          label: 'Copy',
          onClick: () => {
            void navigator.clipboard?.writeText(requestId);
          },
        }
      : undefined,
  });
}
