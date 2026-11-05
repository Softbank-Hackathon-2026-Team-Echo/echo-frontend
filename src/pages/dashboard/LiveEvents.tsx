import { memo } from 'react';
import { Panel } from '@/components/Panel';
import type { Disaster } from '@/lib/api/disasters';
import { useRecentOrgEvents } from '@/lib/api/events';
import type { EnvironmentSummary } from '@/lib/api/types';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type LiveEvent = { at: string; text: string; tone: 'danger' | 'warning' | 'neutral' };

// 접속 상태마다 문장이 달라 값을 끼우지 않고 문구를 따로 둔다. 모르는 값은 서버 값 그대로 보인다
const CONNECTION_EVENTS: Record<string, string> = {
  UNCHECKED: k('{{name}} connection unchecked'),
  CONNECTED: k('{{name}} connection connected'),
  FAILED: k('{{name}} connection failed'),
};

function connectionEvent(name: string, status: string) {
  const message = CONNECTION_EVENTS[status];
  return message
    ? t(message, { name })
    : t('{{name}} connection {{status}}', { name, status: status.toLowerCase() });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false });
}

/**
 * 최근 이벤트. 실시간 채널(계약 3장 🆕)에서 받은 이벤트에 지금 가진 데이터(재난 · 접속 확인)를 더한다
 */
export const LiveEvents = memo(function LiveEvents({
  disasters,
  environments,
}: {
  disasters: Disaster[];
  environments: EnvironmentSummary[];
}) {
  const names = new Map(environments.map((item) => [item.id, item.name]));
  const events: LiveEvent[] = useRecentOrgEvents().map((event) => ({
    at: event.ts,
    text: event.resource
      ? `${event.type} · ${event.resource.name ?? names.get(event.resource.id) ?? event.resource.id.slice(0, 8)}`
      : event.type,
    tone: event.type.startsWith('disaster.') ? 'danger' : 'neutral',
  }));
  for (const disaster of disasters) {
    events.push({
      at: disaster.startedAt,
      text: `disaster.started · M${disaster.magnitude.toFixed(1)} ${disaster.epicenterLabel}`,
      tone: 'danger',
    });
    for (const id of disaster.affectedEnvironmentIds) {
      events.push({
        at: disaster.startedAt,
        text: t('{{name}} → at risk', { name: names.get(id) ?? id }),
        tone: 'warning',
      });
    }
    events.push({
      at: disaster.startedAt,
      text: t('{{total}} safe targets found', { total: disaster.safeEnvironmentIds.length }),
      tone: 'neutral',
    });
  }
  for (const environment of environments) {
    if (environment.connectionCheckedAt) {
      events.push({
        at: environment.connectionCheckedAt,
        text: connectionEvent(environment.name, environment.connectionStatus),
        tone: environment.connectionStatus === 'FAILED' ? 'danger' : 'neutral',
      });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Panel title={t('Live events')}>
      {events.length === 0 ? (
        <p className="text-small text-fg-muted">{t('Nothing has happened yet.')}</p>
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
});
