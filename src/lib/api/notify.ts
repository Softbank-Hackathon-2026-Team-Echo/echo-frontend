import { toast } from 'sonner';
import { t } from '../i18n';
import { describeApiError, isApiError } from './errors';

function copyAction(requestId: string | null) {
  return requestId
    ? {
        label: t('Copy'),
        onClick: () => {
          void navigator.clipboard?.writeText(requestId);
        },
      }
    : undefined;
}

/** 오류 토스트. 요청 ID 가 있으면 함께 보여 주고 복사할 수 있게 한다 */
export function notifyApiError(error: unknown) {
  const requestId = isApiError(error) ? error.requestId : null;
  toast.error(describeApiError(error), {
    description: requestId ? t('Request ID {{id}}', { id: requestId }) : undefined,
    action: copyAction(requestId),
  });
}

/** 오류 코드 · 서버 메시지까지 보이는 토스트. 패치 승인처럼 무엇에 막혔는지(PATCH_STALE 등) 바로 읽어야 할 때 쓴다 */
export function notifyApiErrorWithCode(error: unknown) {
  const requestId = isApiError(error) ? error.requestId : null;
  const lines = [
    isApiError(error) ? [error.code, error.message].filter(Boolean).join(' · ') : null,
    requestId ? t('Request ID {{id}}', { id: requestId }) : null,
  ].filter(Boolean);
  toast.error(describeApiError(error), {
    description: lines.length > 0 ? lines.join('\n') : undefined,
    action: copyAction(requestId),
  });
}
