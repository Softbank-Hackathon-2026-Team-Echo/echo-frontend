import { CalendarClock, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { HistoryEvent } from '@/lib/disaster-history';
import { fullDateTime } from '@/lib/format';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ProvenanceBadges } from './ProvenanceBadges';

export type HistoryFilters = { q: string; source: string; period: string };

export const EMPTY_HISTORY_FILTERS: HistoryFilters = { q: '', source: 'ALL', period: 'ALL' };

export type HistoryListState =
  | { kind: 'contract-pending' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown; onRetry: () => void }
  | { kind: 'ready'; items: HistoryEvent[]; page: number; hasNext: boolean };

const SOURCE_OPTIONS = [
  { value: 'ALL', label: k('All sources') },
  { value: 'USGS_ARCHIVE', label: k('USGS record') },
  { value: 'SIMULATED', label: k('Simulated') },
];

const PERIOD_OPTIONS = [
  { value: 'ALL', label: k('Any time') },
  { value: '30D', label: k('Last 30 days') },
  { value: '1Y', label: k('Last year') },
];

type HistoryEventListProps = {
  list: HistoryListState;
  selectedId: string | null;
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="min-w-0 flex-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: HistoryEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(event.id)}
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-md border border-line p-3 text-left hover:bg-subtle',
          selected && 'border-brand bg-brand-subtle hover:bg-brand-subtle',
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-body-medium">
            {event.place ?? t('Place unknown')}
          </span>
          <span className="shrink-0 font-mono text-mono tabular-nums">
            {event.magnitude === null ? '—' : `M${event.magnitude.toFixed(1)}`}
          </span>
        </span>
        <span className="text-caption text-fg-muted">
          {fullDateTime(event.occurredAt, event.timeZone)}
        </span>
        <ProvenanceBadges event={event} />
      </button>
    </li>
  );
}

/** 지나간 재난 목록. 진행 중 재난은 대시보드 칸이 맡고 여기서는 조회만 한다 */
export function HistoryEventList({
  list,
  selectedId,
  filters,
  onFiltersChange,
  onSelect,
  onPageChange,
}: HistoryEventListProps) {
  if (list.kind === 'contract-pending') {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t('Past disaster records are not connected yet')}
        description={t(
          'The server query for past events is not ready. This is not the same as having no past disasters, and no sample records are shown.',
        )}
      />
    );
  }

  return (
    <Panel title={t('Past events')}>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search aria-hidden className="absolute top-2 left-2 size-4 text-fg-muted" />
          <Input
            aria-label={t('Search events')}
            placeholder={t('Search by place or event ID')}
            value={filters.q}
            onChange={(event) => onFiltersChange({ ...filters, q: event.target.value })}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <FilterSelect
            label={t('Period')}
            value={filters.period}
            options={PERIOD_OPTIONS}
            onChange={(period) => onFiltersChange({ ...filters, period })}
          />
          <FilterSelect
            label={t('Source')}
            value={filters.source}
            options={SOURCE_OPTIONS}
            onChange={(source) => onFiltersChange({ ...filters, source })}
          />
        </div>
      </div>
      {list.kind === 'loading' && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {list.kind === 'error' && <ErrorState error={list.error} onRetry={list.onRetry} />}
      {list.kind === 'ready' &&
        (list.items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t('No events match these filters')}
            description={t('Change the period, source, or search and try again.')}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {list.items.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  selected={event.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={list.page === 0}
                onClick={() => onPageChange(list.page - 1)}
              >
                <ChevronLeft aria-hidden />
                {t('Previous')}
              </Button>
              <span className="text-caption text-fg-muted">
                {list.hasNext
                  ? t('Page {{page}}', { page: list.page + 1 })
                  : t('Page {{page}} · last page', { page: list.page + 1 })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!list.hasNext}
                onClick={() => onPageChange(list.page + 1)}
              >
                {t('Next')}
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </>
        ))}
    </Panel>
  );
}
