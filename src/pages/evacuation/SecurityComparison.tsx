import { SecurityCompareTable } from '@/components/SecurityCompareTable';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SecurityCompare } from '@/lib/api/types';
import { t } from '@/lib/i18n';

/** 이전 전후 보안 비교 (E01-3 오른쪽 패널). 못 불러와도 승인을 막지 않는다. 막는 것은 서버 게이트다 */
export function SecurityComparison({
  compare,
  isError,
  sourceName,
  targetName,
}: {
  compare: SecurityCompare | undefined;
  isError: boolean;
  sourceName: string;
  targetName: string;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-title">{t('Security before / after')}</h2>
        {compare?.simulated && <SimulatedBadge />}
      </header>
      {compare ? (
        <SecurityCompareTable rows={compare.rows} sourceName={sourceName} targetName={targetName} />
      ) : isError ? (
        <p className="text-small text-fg-muted">
          {t('The security comparison is not available right now.')}
        </p>
      ) : (
        <Skeleton className="h-40" />
      )}
    </section>
  );
}
