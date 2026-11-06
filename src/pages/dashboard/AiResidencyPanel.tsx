import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiResidency } from '@/lib/api/residency';
import type { AiResidencySummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { residencyReasonLabel } from '@/lib/status';
import { cn } from '@/lib/utils';

function verdictText(summary: AiResidencySummary) {
  const { runs, verdict } = summary.sensitiveExternalTransfer;
  if (verdict === 'DETECTED') return t('{{count}} sensitive transfers detected', { count: runs });
  if (verdict === 'ZERO') return t('No sensitive data left the platform');
  // 기록 없는 실행이 있으면 0건이라고 단정하지 않는다
  return t('0 in recorded runs · {{count}} without a record', {
    count: summary.runs.unrecorded,
  });
}

/** 대시보드 AI 데이터 레지던시 요약(최근 7일) */
export function AiResidencyPanel({ orgId, className }: { orgId: string; className?: string }) {
  const residency = useAiResidency(orgId);
  const data = residency.data;
  const reasons = [...new Set(data?.violations.flatMap((item) => item.reasons) ?? [])];
  const regionless = data?.recentRuns.filter((run) => run.regionlessAllowed).length ?? 0;
  const regionlessProviders = data?.policy.allowedRegionlessProviders ?? [];

  return (
    <Panel title={t('AI data residency')} className={className}>
      {residency.isPending ? (
        <Skeleton className="h-32" />
      ) : !data ? (
        <p className="text-small text-fg-muted">
          {t('Residency data is not available right now.')}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-metric-xl tabular-nums',
                data.sensitiveExternalTransfer.verdict === 'DETECTED' && 'text-danger-fg',
              )}
            >
              {data.sensitiveExternalTransfer.runs}
            </span>
            <span className="text-small text-fg-secondary">{verdictText(data)}</span>
          </div>
          <p className="text-small text-fg-secondary tabular-nums">
            {t('Last 7 days: {{total}} runs · {{recorded}} recorded · {{external}} sent outside', {
              total: data.runs.total,
              recorded: data.runs.recorded,
              external: data.runs.externalTransfer,
            })}
          </p>
          {regionless > 0 && (
            <p className="text-small text-ai-fg tabular-nums">
              {t('Recent runs on an overseas model, no secrets sent: {{count}}', {
                count: regionless,
              })}
            </p>
          )}
          {regionlessProviders.length > 0 && (
            <p className="text-small text-fg-muted">
              {t('Allowed without a region if no forbidden data is sent: {{providers}}', {
                providers: regionlessProviders.map((item) => item.provider).join(', '),
              })}
            </p>
          )}
          {reasons.map((reason) => (
            <p key={reason} className="text-small text-warning-fg">
              {residencyReasonLabel(reason)}
            </p>
          ))}
        </>
      )}
    </Panel>
  );
}
