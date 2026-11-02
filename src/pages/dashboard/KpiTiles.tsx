import type { ServiceOnEnvironment } from './types';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
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
      <span className="text-caption text-fg-muted">Metrics API pending</span>
    </>
  );
}

/** S01 KPI 타일 5개. 트래픽 비율만 지금 API(서비스 연결)로 채운다 */
export function KpiTiles({ serving }: { serving: ServiceOnEnvironment | undefined }) {
  const weight = serving?.link.trafficWeight ?? 0;
  return (
    <div className="grid grid-cols-5 gap-4 max-compact:grid-cols-2">
      <Tile label="Success rate">
        <Pending />
      </Tile>
      <Tile label="p95 latency">
        <Pending />
      </Tile>
      <Tile label="Replication lag">
        <Pending />
      </Tile>
      <Tile label="Traffic on primary">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-metric-xl tabular-nums">{serving ? `${weight}%` : '—'}</span>
          {serving && (
            <span className="rounded-sm bg-success-bg px-1.5 text-label text-success-fg">
              {serving.link.environment.name}
            </span>
          )}
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-subtle">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${weight}%` }} />
        </span>
      </Tile>
      <Tile label="Error budget left">
        <Pending />
      </Tile>
    </div>
  );
}
