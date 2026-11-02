import { Panel } from '@/components/Panel';
import type { Disaster } from '@/lib/api/disasters';
import type { EnvironmentSummary } from '@/lib/api/types';
import { cn } from '@/lib/utils';

type LiveEvent = { at: string; text: string; tone: 'danger' | 'warning' | 'neutral' };

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false });
}

/**
 * 최근 이벤트. 실시간 채널(계약 3장 🆕)이 생기기 전까지는 지금 가진 데이터(재난 · 접속 확인)로 만든다
 */
export function LiveEvents({
  disasters,
  environments,
}: {
  disasters: Disaster[];
  environments: EnvironmentSummary[];
}) {
  const names = new Map(environments.map((item) => [item.id, item.name]));
  const events: LiveEvent[] = [];
  for (const disaster of disasters) {
    events.push({
      at: disaster.startedAt,
      text: `disaster.started · M${disaster.magnitude.toFixed(1)} ${disaster.epicenterLabel}`,
      tone: 'danger',
    });
    for (const id of disaster.affectedEnvironmentIds) {
      events.push({
        at: disaster.startedAt,
        text: `${names.get(id) ?? id} → at risk`,
        tone: 'warning',
      });
    }
    events.push({
      at: disaster.startedAt,
      text: `${disaster.safeEnvironmentIds.length} safe targets found`,
      tone: 'neutral',
    });
  }
  for (const environment of environments) {
    if (environment.connectionCheckedAt) {
      events.push({
        at: environment.connectionCheckedAt,
        text: `${environment.name} connection ${environment.connectionStatus.toLowerCase()}`,
        tone: environment.connectionStatus === 'FAILED' ? 'danger' : 'neutral',
      });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Panel title="Live events">
      {events.length === 0 ? (
        <p className="text-small text-fg-muted">Nothing has happened yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {events.slice(0, 6).map((event, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 같은 시각 이벤트가 여럿이라 순서로 구분한다
            <li key={index} className="flex gap-3 text-body">
              <span className="shrink-0 font-mono text-mono leading-5 text-fg-muted">
                {clock(event.at)}
              </span>
              <span
                className={cn(
                  event.tone === 'danger' && 'text-danger-fg',
                  event.tone === 'warning' && 'text-warning-fg',
                )}
              >
                {event.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
