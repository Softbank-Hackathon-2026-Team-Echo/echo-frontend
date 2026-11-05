import { useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { configValue, isActivePrecheck, usePrecheckLogs } from '@/lib/api/prechecks';
import type { PrecheckDetail } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { securityResultView } from '@/lib/status';
import { cn } from '@/lib/utils';
import { PatchReview } from './PatchReview';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB');

const SEVERITY_CLASS: Record<string, string> = {
  WARN: 'text-warning-fg',
  FAIL: 'text-danger-fg',
};

function Empty({ children }: { children: string }) {
  return <p className="text-small text-fg-muted">{children}</p>;
}

function Findings({ precheck }: { precheck: PrecheckDetail }) {
  if (precheck.findings.length === 0) return <Empty>{t('No findings in this run.')}</Empty>;
  return precheck.findings.map((finding) => (
    <article
      key={`${finding.control}-${finding.title}`}
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4"
    >
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge {...securityResultView(finding.result)} />
        {finding.origin === 'AI' && <StatusBadge label="AI" tone="ai" />}
        <h3 className="text-title">{finding.title}</h3>
      </span>
      <p className="text-body text-fg-secondary">{finding.reason}</p>
      {finding.suggestedFix && (
        <p className="rounded-md bg-subtle p-2 text-small whitespace-pre-wrap">
          {finding.suggestedFix}
        </p>
      )}
      {finding.confirmation === 'UNCONFIRMED' && (
        <p className="text-caption text-fg-muted">{t('Not confirmed by a person')}</p>
      )}
    </article>
  ));
}

function FeatureGaps({
  precheck,
  sourceLabel,
  targetLabel,
}: {
  precheck: PrecheckDetail;
  sourceLabel: string;
  targetLabel: string;
}) {
  if (precheck.featureGaps.length === 0) return <Empty>{t('No feature gaps in this run.')}</Empty>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{sourceLabel}</TableHead>
            <TableHead>{targetLabel}</TableHead>
            <TableHead>{t('Gap')}</TableHead>
            <TableHead>{t('Action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {precheck.featureGaps.map((gap) => (
            <TableRow key={`${gap.source}-${gap.target}`}>
              <TableCell>{gap.source}</TableCell>
              <TableCell>{gap.target}</TableCell>
              <TableCell className="font-mono text-mono">{gap.gap}</TableCell>
              <TableCell className={gap.hasReplacement ? 'text-fg-secondary' : 'text-warning-fg'}>
                {gap.action}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ConfigDiff({
  precheck,
  sourceLabel,
  targetLabel,
}: {
  precheck: PrecheckDetail;
  sourceLabel: string;
  targetLabel: string;
}) {
  if (precheck.configDiff.length === 0) return <Empty>{t('No config differences found.')}</Empty>;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Key')}</TableHead>
            <TableHead>{sourceLabel}</TableHead>
            <TableHead>{targetLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {precheck.configDiff.map((change) => (
            <TableRow key={change.key}>
              <TableCell className={cn('font-mono text-mono', SEVERITY_CLASS[change.severity])}>
                {change.key}
              </TableCell>
              <TableCell className="font-mono text-mono break-all whitespace-normal">
                {configValue(change.source)}
              </TableCell>
              <TableCell className="font-mono text-mono break-all whitespace-normal">
                {configValue(change.target)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Logs({ orgId, precheck }: { orgId: string; precheck: PrecheckDetail }) {
  const logs = usePrecheckLogs(orgId, precheck.id, isActivePrecheck(precheck.status));
  const items = logs.data?.items ?? [];
  if (items.length === 0) return <Empty>{t('No log lines yet.')}</Empty>;
  return (
    <ol className="flex flex-col gap-1 rounded-xl border border-line bg-subtle p-4 font-mono text-mono">
      {items.map((line) => (
        <li key={line.seq} className="flex gap-4">
          <span className="shrink-0 text-fg-muted">{clock(line.at)}</span>
          <span
            className={cn(
              'w-10 shrink-0',
              line.level === 'ERROR'
                ? 'text-danger-fg'
                : line.level === 'WARN'
                  ? 'text-warning-fg'
                  : 'text-fg-muted',
            )}
          >
            {line.level}
          </span>
          <span className="shrink-0 text-fg-secondary">{line.step}</span>
          <span className="break-all">{line.message}</span>
        </li>
      ))}
    </ol>
  );
}

/** 점검 결과 탭: 발견 항목 · 패치 · 기능 격차 · 설정 차이 · 로그 */
export function PrecheckResults({
  orgId,
  precheck,
  sourceName,
  targetName,
}: {
  orgId: string;
  precheck: PrecheckDetail;
  sourceName: string;
  targetName: string;
}) {
  const [tab, setTab] = useState('findings');
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="findings">
          {t('Findings ({{n}})', { n: precheck.findings.length })}
        </TabsTrigger>
        <TabsTrigger value="patches">
          {t('Patches ({{n}})', { n: precheck.patches.length })}
        </TabsTrigger>
        <TabsTrigger value="gaps">
          {t('Feature gaps ({{n}})', { n: precheck.featureGaps.length })}
        </TabsTrigger>
        <TabsTrigger value="config">
          {t('Config diff ({{n}})', { n: precheck.configDiff.length })}
        </TabsTrigger>
        <TabsTrigger value="logs">{t('Logs')}</TabsTrigger>
      </TabsList>
      <TabsContent value="findings" className="flex flex-col gap-3">
        <Findings precheck={precheck} />
      </TabsContent>
      <TabsContent value="patches" className="flex flex-col gap-3">
        {precheck.patches.length === 0 ? (
          <Empty>{t('No patches in this run.')}</Empty>
        ) : (
          precheck.patches.map((patch, index) => (
            <PatchReview
              key={patch.id}
              orgId={orgId}
              precheckId={precheck.id}
              patch={patch}
              number={index + 1}
            />
          ))
        )}
      </TabsContent>
      <TabsContent value="gaps">
        <FeatureGaps precheck={precheck} sourceLabel={sourceName} targetLabel={targetName} />
      </TabsContent>
      <TabsContent value="config">
        <ConfigDiff precheck={precheck} sourceLabel={sourceName} targetLabel={targetName} />
      </TabsContent>
      <TabsContent value="logs">
        <Logs orgId={orgId} precheck={precheck} />
      </TabsContent>
    </Tabs>
  );
}
