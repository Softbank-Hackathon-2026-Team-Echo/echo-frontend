import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { DisasterHistoryView } from '@/pages/history/DisasterHistoryView';
import { EMPTY_HISTORY_FILTERS, type HistoryFilters } from '@/pages/history/HistoryEventList';
import { fixtureDetails, fixtureEvents } from '@/test/disaster-history-fixture';

/** 개발 서버 전용. 서버 계약 전에 데이터가 있는 화면 모양을 본다. 실제 기록이 아니다 */
export default function DisasterHistoryPreview() {
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(fixtureDetails[0]?.id ?? null);
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  const detail = fixtureDetails.find((item) => item.id === selectedId);
  const items = fixtureEvents.filter((event) =>
    (event.place ?? '').toLowerCase().includes(filters.q.toLowerCase()),
  );

  return (
    <main className="mx-auto flex max-w-content flex-col gap-4 bg-canvas p-4">
      <p className="rounded-md bg-warning-bg p-2 text-small text-warning-fg">
        Local layout fixture. These are not real records and this page is not in production builds.
      </p>
      <DisasterHistoryView
        scopeKey="preview"
        list={
          params.get('state') === 'pending'
            ? { kind: 'contract-pending' }
            : { kind: 'ready', items, page: 0, hasNext: false }
        }
        detail={detail ? { kind: 'ready', detail } : { kind: 'none' }}
        selectedId={selectedId}
        filters={filters}
        operations={{
          liveIntakeStatus: 'DISABLED',
          isLiveIntakeStale: false,
          liveIntakeCheckedAt: null,
          autoMigrationEnabled: null,
        }}
        onFiltersChange={setFilters}
        onSelect={setSelectedId}
        onPageChange={() => {}}
      />
    </main>
  );
}
