import { TriangleAlert } from 'lucide-react';
import { useServices } from '@/lib/api/services';
import { t } from '@/lib/i18n';

/** 진입점 가중치와 DB 쓰기 담당은 조직 전체에 한 벌이다. 서비스별로 나뉘기 전까지 이전 전에 밝힌다 */
export function SharedTrafficNotice({ orgId }: { orgId: string }) {
  const services = useServices(orgId);
  if ((services.data?.items.length ?? 0) < 2) return null;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-md bg-warning-bg px-3 py-2 text-body text-warning-fg"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {t(
        'Services share traffic weights and the database writer today, so every service moves together.',
      )}
    </p>
  );
}
