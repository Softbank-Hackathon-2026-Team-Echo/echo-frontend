import { Download, Search, SquareTerminal } from 'lucide-react';
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

// 줄 왼쪽 색 막대(Railway): 에러 빨강 · 경고 노랑 · 그 밖 파랑
const LEVEL_BAR: Record<string, string> = {
  WARN: 'border-warning-solid',
  ERROR: 'border-danger-solid bg-danger-bg',
};

function timeOf(at: string) {
  return new Date(at).toLocaleTimeString('en-GB');
}

/** 불러온 줄만 내려받는다. 서버가 이미 비밀값을 가린 줄이다 */
function downloadLines(name: string, lines: { at: string; level: string; message: string }[]) {
  const text = lines.map((line) => `${line.at} ${line.level} ${line.message}`).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LogLines({
  orgId,
  request,
  source,
  query,
}: {
  orgId: string;
  request: DeployRequestDetail;
  source: (typeof SOURCES)[number];
  query: string;
}) {
  const live = !isTerminalStatus(request.status);
  const logs = useDeployLogs(orgId, request.id, source.value, live);

  if (logs.isError) return <ErrorState error={logs.error} onRetry={() => logs.refetch()} />;
  if (logs.isPending) return <Skeleton className="m-4 h-24" />;

  const all = logs.data.pages.flatMap((page) => page.items);
  const needle = query.trim().toLowerCase();
  const lines = needle
    ? all.filter((line) => `${line.level} ${line.message}`.toLowerCase().includes(needle))
    : all;
  const simulated = logs.data.pages.some((page) => page.simulated);
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        {simulated && <SimulatedBadge />}
        {needle && (
          <span className="text-caption text-fg-muted">
            {t('{{shown}} of {{total}} lines', { shown: lines.length, total: all.length })}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={all.length === 0}
          onClick={() =>
            downloadLines(`deploy-${request.id.slice(0, 8)}-${source.value.toLowerCase()}.log`, all)
          }
        >
          <Download aria-hidden />
          {t('Download')}
        </Button>
      </div>
      {/* 되돌리기·예비 따라가기는 예전 빌드를 다시 쓴다. 시각이 이번 배포보다 이른 이유를 알린다 */}
      {source.value === 'BUILD' && request.build?.reused && lines.length > 0 && (
        <p className="text-small text-fg-secondary">
          {t('This build was reused from an earlier deploy. The lines below are from that build.')}
        </p>
      )}
      {lines.length === 0 ? (
        <p className="text-small text-fg-muted">
          {needle ? t('No lines match "{{query}}".', { query }) : t(source.empty)}
        </p>
      ) : (
        <ol className="flex max-h-96 flex-col overflow-y-auto font-mono text-mono">
          {lines.map((line, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: 로그 줄에는 id 가 없고 시간 순으로만 쌓인다
              key={index}
              className={cn(
                'flex gap-4 border-l-2 py-0.5 pl-2',
                LEVEL_BAR[line.level] ?? 'border-migrating-solid',
              )}
            >
              <span className="shrink-0 text-fg-muted">{timeOf(line.at)}</span>
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
export function DeployLogs({
  orgId,
  request,
  defaultSource = 'DEPLOY_JOB',
}: {
  orgId: string;
  request: DeployRequestDetail;
  /** 처음 열 로그 (AI 진단의 "빌드 로그 열기"가 BUILD 로 다시 연다) */
  defaultSource?: LogSource;
}) {
  const [source, setSource] = useState<LogSource>(defaultSource);
  const [query, setQuery] = useState('');
  const current = SOURCES.find((item) => item.value === source) ?? SOURCES[0];

  return (
    <section
      id="deploy-logs"
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-subtle"
    >
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
        <div className="relative ml-auto">
          <label htmlFor="deploy-log-search" className="sr-only">
            {t('Search logs')}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-2 left-2 size-4 text-fg-muted"
          />
          <Input
            id="deploy-log-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search logs')}
            className="h-8 w-48 pl-8"
          />
        </div>
        {!isTerminalStatus(request.status) && (
          <span className="flex items-center gap-1.5 text-caption text-success-fg">
            <span aria-hidden className="size-1.5 rounded-full bg-success-solid" />
            {t('Live')}
          </span>
        )}
      </header>
      {current && (
        <LogLines
          key={current.value}
          orgId={orgId}
          request={request}
          source={current}
          query={query}
        />
      )}
    </section>
  );
}
