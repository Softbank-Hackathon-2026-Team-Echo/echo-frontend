import { memo } from 'react';
import type { Disaster } from '@/lib/api/disasters';
import { t } from '@/lib/i18n';

const NO_FAILING: string[] = [];

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * 대시보드 제목 옆 상태 알약: 이전 중 > 재난 > 배포 실패 > 정상 (Figma 시연 장면 1~3).
 * 서비스 카드가 실패인데 알약이 정상이면 어긋나 보여서, 마지막 배포가 실패한 서비스를 적는다
 */
export const StatusPill = memo(function StatusPill({
  migrating,
  disaster,
  names,
  failing = NO_FAILING,
  onprem,
}: {
  migrating: { name: string; weight: number } | undefined;
  disaster: Disaster | undefined;
  names: Map<string, string>;
  failing?: string[];
  /** 온프레 실시간(노트북 감시자) 장애 · 복구 한 줄. 평소엔 없다 */
  onprem?: { tone: 'danger' | 'warning'; text: string };
}) {
  if (onprem && !migrating) {
    return (
      <span
        data-testid="onprem-live-line"
        data-tone={onprem.tone}
        className={
          onprem.tone === 'danger'
            ? 'inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-0.5 text-label text-danger-fg'
            : 'inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-0.5 text-label text-warning-fg'
        }
      >
        <span
          aria-hidden
          className={
            onprem.tone === 'danger'
              ? 'size-1.5 rounded-full bg-danger-solid'
              : 'size-1.5 rounded-full bg-warning-solid'
          }
        />
        {onprem.text}
      </span>
    );
  }
  if (migrating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-migrating-bg px-2.5 py-0.5 text-label text-migrating-fg">
        <span aria-hidden className="size-1.5 rounded-full bg-migrating-solid" />
        {t('Evacuating to {{target}} · {{weight}}%', {
          target: migrating.name,
          weight: migrating.weight,
        })}
      </span>
    );
  }
  if (disaster) {
    const affected = disaster.affectedEnvironmentIds.map((id) => names.get(id)).join(', ');
    const values = {
      magnitude: disaster.magnitude.toFixed(1),
      place: disaster.epicenterLabel,
      time: clock(disaster.startedAt),
    };
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-0.5 text-label text-danger-fg">
        <span aria-hidden className="size-1.5 rounded-full bg-danger-solid" />
        {affected
          ? t('M{{magnitude}} {{place}} · {{environments}} at risk · {{time}}', {
              ...values,
              environments: affected,
            })
          : t('M{{magnitude}} {{place}} · nothing at risk · {{time}}', values)}
      </span>
    );
  }
  if (failing.length > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-0.5 text-label text-warning-fg">
        <span aria-hidden className="size-1.5 rounded-full bg-warning-solid" />
        {t('Last deploy failed · {{services}}', { services: failing.join(', ') })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 text-label text-success-fg">
      <span aria-hidden className="size-1.5 rounded-full bg-success-solid" />
      {t('All systems normal')}
    </span>
  );
});
