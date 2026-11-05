import { History, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { AuditRow } from '@/components/AuditRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type AuditFilters, useAuditLogs } from '@/lib/api/audit';
import { useCurrentOrg } from '@/lib/api/me';
import type { AuditActorType } from '@/lib/api/types';
import { k, t } from '@/lib/i18n';

const SEARCH_DELAY_MS = 300;
const MAX_SEARCH_LENGTH = 100;

const ACTOR_TABS: { value: AuditActorType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: k('All') },
  { value: 'USER', label: k('People') },
  { value: 'AGENT', label: k('AI Agent') },
  { value: 'SYSTEM', label: k('System') },
];

/** AUD 감사 로그: 누가 · 언제 · 무엇을 · 결과. 거부된 시도도 남는다(F5 · F16) */
export default function AuditPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const [actor, setActor] = useState<AuditActorType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters: AuditFilters = {
    ...(actor === 'ALL' ? {} : { actorType: actor }),
    ...(q ? { q } : {}),
  };
  const logs = useAuditLogs(organization?.id, filters);
  const items = logs.data?.pages.flatMap((page) => page.items) ?? [];
  const isFiltered = actor !== 'ALL' || Boolean(q);

  return (
    <>
      <PageHeader
        title={t('Audit log')}
        description={t(
          'Who did what, when, with what result. Actor types: person, AI Agent, System.',
        )}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={actor} onValueChange={(value) => setActor(value as typeof actor)}>
          <TabsList>
            {ACTOR_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {t(tab.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-64 max-compact:w-full">
          <Search
            aria-hidden
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted"
          />
          <Input
            aria-label={t('Filter by target or action')}
            placeholder={t('Filter by target or action')}
            className="pl-8"
            maxLength={MAX_SEARCH_LENGTH}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
        ) : logs.isPending ? (
          <Skeleton className="h-64" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title={isFiltered ? t('No matching entries') : t('No activity yet')}
            description={
              isFiltered
                ? t('Try another actor type or search word.')
                : t('Approvals, deploys and agent actions will show here.')
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface px-4 py-1.5">
            {items.map((log) => (
              <AuditRow key={log.id} log={log} />
            ))}
          </ul>
        )}
        {logs.hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={logs.isFetchingNextPage}
            onClick={() => logs.fetchNextPage()}
          >
            {t('Load more')}
          </Button>
        )}
      </div>
    </>
  );
}
