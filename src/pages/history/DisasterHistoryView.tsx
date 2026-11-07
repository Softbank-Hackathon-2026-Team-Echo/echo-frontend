import { MousePointerClick, SearchX } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type HistoryDetail, weightsAt } from '@/lib/disaster-history';
import { fullDateTime, timeAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { autoMigrationView, liveIntakeView } from '@/lib/status';
import { cn } from '@/lib/utils';
import { HistoryEventList, type HistoryFilters, type HistoryListState } from './HistoryEventList';
import { HistoryEventSummary } from './HistoryEventSummary';
import { HistoryMap } from './HistoryMap';
import { HistoryTimeline } from './HistoryTimeline';
import { useReplay } from './useReplay';

export type HistoryDetailState =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown; onRetry: () => void }
  | { kind: 'not-found' }
  | { kind: 'ready'; detail: HistoryDetail };

export type HistoryOperations = {
  liveIntakeStatus: string | null;
  isLiveIntakeStale: boolean;
  liveIntakeCheckedAt: string | null;
  autoMigrationEnabled: boolean | null;
};

type MobilePanel = 'list' | 'detail' | 'timeline';

type DisasterHistoryViewProps = {
  /** 조직 · 재생 종류 · 사건마다 재생 위치를 새로 시작한다 */
  scopeKey: string;
  list: HistoryListState;
  detail: HistoryDetailState;
  selectedId: string | null;
  filters: HistoryFilters;
  operations: HistoryOperations;
  onFiltersChange: (filters: HistoryFilters) => void;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
};

function ReplayPanels({ detail, panel }: { detail: HistoryDetail; panel: MobilePanel }) {
  const replay = useReplay(detail.steps.length);
  const weights = weightsAt(detail.steps, replay.index);
  const stepTime = detail.steps[replay.index]?.at;
  const selectedTime = stepTime ? fullDateTime(stepTime, detail.timeZone) : t("Can't confirm");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className={cn('flex flex-col gap-4', panel !== 'detail' && 'max-compact:hidden')}>
        <HistoryEventSummary detail={detail} weights={weights} selectedTime={selectedTime} />
      </div>
      <div className="flex flex-col gap-4 wide:flex-row wide:items-start">
        <div className={cn('min-w-0 flex-1', panel !== 'detail' && 'max-compact:hidden')}>
          <HistoryMap detail={detail} weights={weights} selectedTime={selectedTime} />
        </div>
        <div className={cn('min-w-0 flex-1', panel !== 'timeline' && 'max-compact:hidden')}>
          <HistoryTimeline detail={detail} replay={replay} />
        </div>
      </div>
    </div>
  );
}

function DetailPlaceholder({ detail }: { detail: Exclude<HistoryDetailState, { kind: 'ready' }> }) {
  if (detail.kind === 'loading') {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (detail.kind === 'error') return <ErrorState error={detail.error} onRetry={detail.onRetry} />;
  if (detail.kind === 'not-found') {
    return (
      <EmptyState
        icon={SearchX}
        title={t('This event was not found')}
        description={t('Pick another event from the list.')}
        className="flex-1"
      />
    );
  }
  return (
    <EmptyState
      icon={MousePointerClick}
      title={t('Pick an event')}
      description={t('The map and timeline for that event appear here.')}
      className="flex-1"
    />
  );
}

/** 과거 재난 조회 재생(#100). 데이터는 props 로만 받고 실행 훅을 쓰지 않는다 */
export function DisasterHistoryView({
  scopeKey,
  list,
  detail,
  selectedId,
  filters,
  operations,
  onFiltersChange,
  onSelect,
  onPageChange,
}: DisasterHistoryViewProps) {
  const [panel, setPanel] = useState<MobilePanel>('list');
  const isPending = list.kind === 'contract-pending';

  function handleSelect(id: string) {
    onSelect(id);
    setPanel('detail');
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('Disaster history')}
        description={t('Replay past events. Nothing here changes services or traffic.')}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={t('Past replay · read only')} tone="neutral" />
        <StatusBadge
          {...liveIntakeView(operations.liveIntakeStatus, operations.isLiveIntakeStale)}
        />
        <StatusBadge {...autoMigrationView(operations.autoMigrationEnabled)} />
        {operations.liveIntakeCheckedAt && (
          <span className="text-caption text-fg-muted">
            {t('Checked {{time}}', { time: timeAgo(operations.liveIntakeCheckedAt) })}
          </span>
        )}
      </div>
      {!isPending && (
        <Tabs
          value={panel}
          onValueChange={(value) => setPanel(value as MobilePanel)}
          className="compact:hidden"
        >
          <TabsList>
            <TabsTrigger value="list">{t('Events')}</TabsTrigger>
            <TabsTrigger value="detail">{t('Map and details')}</TabsTrigger>
            <TabsTrigger value="timeline">{t('Timeline')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {isPending ? (
        <HistoryEventList
          list={list}
          selectedId={selectedId}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onSelect={handleSelect}
          onPageChange={onPageChange}
        />
      ) : (
        <div className="flex flex-col gap-4 compact:flex-row compact:items-start">
          <div className={cn('shrink-0 compact:w-80', panel !== 'list' && 'max-compact:hidden')}>
            <HistoryEventList
              list={list}
              selectedId={selectedId}
              filters={filters}
              onFiltersChange={onFiltersChange}
              onSelect={handleSelect}
              onPageChange={onPageChange}
            />
          </div>
          {detail.kind === 'ready' ? (
            <ReplayPanels
              key={`${scopeKey}:${detail.detail.id}`}
              detail={detail.detail}
              panel={panel}
            />
          ) : (
            <div className={cn('flex min-w-0 flex-1', panel === 'list' && 'max-compact:hidden')}>
              <DetailPlaceholder detail={detail} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
