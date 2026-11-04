import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ServiceOnEnvironment } from './types';

function Tile({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4',
        className,
      )}
    >
      <span className="text-small text-fg-secondary">{label}</span>
      {children}
    </div>
  );
}

/** 지표 API(계약 4-2 🆕)가 생기기 전까지는 값을 지어내지 않고 비워 둔다 */
function Pending() {
  return (
    <>
      <span className="text-metric-xl text-fg-muted">—</span>
      <span className="text-caption text-fg-muted">{t('Metrics API pending')}</span>
    </>
  );
}

/** 이전 중이면 트래픽 칸이 도착 환경 비율을 보인다 */
export type TargetTraffic = { name: string; weight: number };

/**
 * S01 KPI 타일 5개(반분할 960 은 4개, 에러 버짓을 뺀다). 트래픽 비율만 지금 API(서비스 연결 · 이전 단계)로 채운다
 */
export function KpiTiles({
  serving,
  target,
}: {
  serving: ServiceOnEnvironment | undefined;
  target?: TargetTraffic;
}) {
  const weight = target?.weight ?? serving?.link.trafficWeight ?? 0;
  const envName = target?.name ?? serving?.link.environment.name;
  const hasValue = Boolean(target || serving);
  return (
    <div className="grid grid-cols-5 gap-4 max-wide:grid-cols-4 max-wide:gap-3 max-sm:grid-cols-2">
      <Tile label={t('Success rate')}>
        <Pending />
      </Tile>
      <Tile label={t('p95 latency')}>
        <Pending />
      </Tile>
      <Tile label={t('Replication lag')}>
        <Pending />
      </Tile>
      <Tile label={target ? t('Traffic on target') : t('Traffic on primary')}>
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-metric-xl tabular-nums">{hasValue ? `${weight}%` : '—'}</span>
          {envName && (
            <span className="rounded-sm bg-success-bg px-1.5 text-label text-success-fg">
              {envName}
            </span>
          )}
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-subtle">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${weight}%` }} />
        </span>
      </Tile>
      <Tile label={t('Error budget left')} className="max-wide:hidden">
        <Pending />
      </Tile>
    </div>
  );
}
