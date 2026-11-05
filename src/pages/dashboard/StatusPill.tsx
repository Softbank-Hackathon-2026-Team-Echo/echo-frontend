import { memo } from 'react';
import type { Disaster } from '@/lib/api/disasters';
import { t } from '@/lib/i18n';

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** 대시보드 제목 옆 상태 알약: 이전 중 > 재난 > 정상 (Figma 시연 장면 1~3) */
export const StatusPill = memo(function StatusPill({
  migrating,
  disaster,
  names,
}: {
  migrating: { name: string; weight: number } | undefined;
  disaster: Disaster | undefined;
  names: Map<string, string>;
}) {
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
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 text-label text-success-fg">
      <span aria-hidden className="size-1.5 rounded-full bg-success-solid" />
      {t('All systems normal')}
    </span>
  );
});
