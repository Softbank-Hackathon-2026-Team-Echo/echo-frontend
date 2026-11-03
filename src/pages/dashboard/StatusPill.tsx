import type { Disaster } from '@/lib/api/disasters';

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** 대시보드 제목 옆 상태 알약: 이전 중 > 재난 > 정상 (Figma 시연 장면 1~3) */
export function StatusPill({
  migrating,
  disaster,
  names,
}: {
  migrating: { target: string; weight: number } | undefined;
  disaster: Disaster | undefined;
  names: Map<string, string>;
}) {
  if (migrating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-migrating-bg px-2.5 py-0.5 text-label text-migrating-fg">
        <span aria-hidden className="size-1.5 rounded-full bg-migrating-solid" />
        Evacuating to {migrating.target} · {migrating.weight}%
      </span>
    );
  }
  if (disaster) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-0.5 text-label text-danger-fg">
        <span aria-hidden className="size-1.5 rounded-full bg-danger-solid" />M
        {disaster.magnitude.toFixed(1)} {disaster.epicenterLabel} ·{' '}
        {disaster.affectedEnvironmentIds.map((id) => names.get(id)).join(', ') || 'nothing'} at risk
        · {clock(disaster.startedAt)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 text-label text-success-fg">
      <span aria-hidden className="size-1.5 rounded-full bg-success-solid" />
      All systems normal
    </span>
  );
}
