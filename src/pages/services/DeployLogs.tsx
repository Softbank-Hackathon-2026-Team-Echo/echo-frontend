import { SquareTerminal } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isTerminalStatus, useDeployLogs } from '@/lib/api/services';
import type { DeployRequestDetail, LogSource } from '@/lib/api/types';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SOURCES: { value: LogSource; label: string; empty: string }[] = [
  { value: 'DEPLOY_JOB', label: k('Deploy'), empty: k('No deploy steps yet.') },
  {
    value: 'BUILD',
    label: k('Build'),
    empty: k('No build log. The build has not started or was reused.'),
  },
  {
    value: 'RUNTIME',
    label: k('Runtime'),
    empty: k('No runtime log. The app is not running yet.'),
  },
];

const LEVEL_CLASS: Record<string, string> = {
  WARN: 'text-warning-fg',
  ERROR: 'text-danger-fg',
};

function LogLines({
  orgId,
  request,
  source,
}: {
  orgId: string;
  request: DeployRequestDetail;
  source: (typeof SOURCES)[number];
}) {
  const live = !isTerminalStatus(request.status);
  const logs = useDeployLogs(orgId, request.id, source.value, live);
  const [query, setQuery] = useState('');

  if (logs.isError) return <ErrorState error={logs.error} onRetry={() => logs.refetch()} />;
  if (logs.isPending) return <Skeleton className="m-4 h-24" />;

  const lines = logs.data.pages.flatMap((page) => page.items);
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? lines.filter((line) => line.message.toLowerCase().includes(needle))
    : lines;
  const simulated = logs.data.pages.some((page) => page.simulated);
  return (
    <div className="flex flex-col gap-2 p-4">
      {simulated && (
        <span className="self-start">
          <SimulatedBadge />
        </span>
      )}
      {/* 되돌리기·예비 따라가기는 예전 빌드를 다시 쓴다. 시각이 이번 배포보다 이른 이유를 알린다 */}
      {source.value === 'BUILD' && request.build?.reused && lines.length > 0 && (
        <p className="text-small text-fg-secondary">
          {t('This build was reused from an earlier deploy. The lines below are from that build.')}
        </p>
      )}
      {lines.length > 0 && (
        <Input
          aria-label={t('Search loaded logs')}
          placeholder={t('Search loaded logs')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {lines.length === 0 ? (
        <p className="text-small text-fg-muted">{t(source.empty)}</p>
      ) : visible.length === 0 ? (
        <p className="text-small text-fg-muted">{t('No lines match.')}</p>
      ) : (
        <ol className="flex max-h-96 flex-col gap-1 overflow-y-auto font-mono text-mono">
          {visible.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 로그 줄에는 id 가 없고 시간 순으로만 쌓인다
            <li key={index} className="flex gap-4">
              <span className="shrink-0 text-fg-muted">
                {new Date(line.at).toLocaleTimeString('en-GB')}
              </span>
              <span className={cn('w-10 shrink-0', LEVEL_CLASS[line.level] ?? 'text-fg-muted')}>
                {line.level}
              </span>
              <span className="break-all">{line.message}</span>
            </li>
          ))}
        </ol>
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
  );
}

/** 배포 요청 로그 3종(배포 작업 · 빌드 · 실행). 진행 중이면 2초마다 새 줄을 받는다 */
export function DeployLogs({ orgId, request }: { orgId: string; request: DeployRequestDetail }) {
  const [source, setSource] = useState<LogSource>('DEPLOY_JOB');
  const current = SOURCES.find((item) => item.value === source) ?? SOURCES[0];

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-subtle">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="flex items-center gap-2 font-mono text-mono text-fg-secondary">
          <SquareTerminal aria-hidden className="size-4" />
          {t('deploy · {{id}}', { id: request.id.slice(0, 8) })}
        </span>
        <Tabs value={source} onValueChange={(value) => setSource(value as LogSource)}>
          <TabsList>
            {SOURCES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {!isTerminalStatus(request.status) && (
          <span className="flex items-center gap-1.5 text-caption text-success-fg">
            <span aria-hidden className="size-1.5 rounded-full bg-success-solid" />
            {t('Live')}
          </span>
        )}
      </header>
      {current && <LogLines key={current.value} orgId={orgId} request={request} source={current} />}
    </section>
  );
}
