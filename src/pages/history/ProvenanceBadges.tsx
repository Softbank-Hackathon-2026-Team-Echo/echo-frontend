import { StatusBadge } from '@/components/StatusBadge';
import type { HistoryEvent } from '@/lib/disaster-history';
import { historyEventSourceView, historyMigrationSourceView } from '@/lib/status';

/** 사건 출처와 이전 출처는 따로 보인다. 실제 사건이어도 이전은 가상일 수 있다 */
export function ProvenanceBadges({
  event,
}: {
  event: Pick<HistoryEvent, 'eventSource' | 'migrationSource'>;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge {...historyEventSourceView(event.eventSource)} />
      <StatusBadge {...historyMigrationSourceView(event.migrationSource)} />
    </span>
  );
}
