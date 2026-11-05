import { CircleAlert, CircleCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNow } from '@/hooks/useNow';
import type { MigrationPlan, MigrationStep } from '@/lib/api/types';
import { k, t } from '@/lib/i18n';
import {
  failedRequests,
  isAwaitingCutover,
  maxReplicationLag,
  passedOnHealthOnly,
  requestCount,
  rowCheck,
  stepSeconds,
  totalSeconds,
  writePauseCaption,
  writePauseText,
} from '@/lib/migration-metrics';
import { duration } from '@/lib/migration-stages';
import { migrationFailureLabel, planFailureLabel } from '@/lib/status';
import { Kpi } from './Kpi';

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB') : '—';

// 단계·실행 상태 값 → 소문자 문구. 모르는 값은 서버 값을 소문자로 보인다
const STATUS_WORDS: Record<string, string> = {
  PENDING: k('pending'),
  RUNNING: k('running'),
  PASSED: k('passed'),
  FAILED: k('failed'),
  SKIPPED: k('skipped'),
};

function statusWord(status: string) {
  const word = STATUS_WORDS[status];
  return word ? t(word) : status.toLowerCase();
}

function stepName(step: MigrationStep) {
  if (step.kind === 'PREFLIGHT') return t('Pre-check');
  if (step.kind === 'DATA_SYNC_CHECK') return t('Data sync check');
  return t('Shift traffic → {{weight}}%', { weight: step.targetWeight ?? '—' });
}

function stepResult(step: MigrationStep) {
  const result = step.result;
  if (!result) return '—';
  const status = statusWord(result.status);
  if (result.failureCode)
    return `${status} · ${migrationFailureLabel(result.failureCode, step.kind)}`;
  const metrics = result.metrics;
  if (step.kind === 'DATA_SYNC_CHECK' && metrics?.replicationLagSeconds != null) {
    return t('{{status}} · lag {{seconds}} s', {
      status,
      seconds: metrics.replicationLagSeconds,
    });
  }
  if (metrics?.lowTraffic)
    return t('{{status}} · low traffic, health {{health}}', {
      status,
      health: metrics.healthStatus ?? t('checked'),
    });
  if (metrics?.requestCount != null) {
    const errors =
      metrics.errors5xx != null
        ? `${metrics.errors5xx}/${metrics.allowedErrors5xx ?? '—'} 5xx`
        : t('{{percent}}% errors', { percent: metrics.errorRatePercent ?? 0 });
    return t('{{status}} · {{requests}} req · {{errors}} · p95 {{ms}} ms', {
      status,
      requests: metrics.requestCount,
      errors,
      ms: metrics.p95Ms ?? '—',
    });
  }
  return status;
}

/** M02 Result: 끝난 이전의 숫자 표(F17). 서버가 아직 주지 않는 값은 — 와 측정 출처를 적는다 */
export function ResultTab({ plan }: { plan: MigrationPlan }) {
  const failed = failedRequests(plan);
  const total = totalSeconds(plan);
  const lag = maxReplicationLag(plan);
  const requests = requestCount(plan);
  const healthOnly = passedOnHealthOnly(plan);
  const clean = plan.status === 'SUCCEEDED' && failed === 0 && !healthOnly;
  const rows = rowCheck(plan);
  // 기다리는 시간이 지나면 다시 부르기가 멈춰도 문구가 바뀌도록 시계를 돌린다
  const now = useNow(isAwaitingCutover(plan));

  return (
    <div className="flex flex-col gap-3">
      {plan.status === 'SUCCEEDED' ? (
        <div className="flex items-start gap-3 rounded-lg bg-success-bg p-3 text-success-fg">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-body-medium">
              {clean ? t('Zero failed requests while traffic moved') : t('Migration finished')}
            </p>
            <p className="text-small">
              {healthOnly
                ? t('Too few requests to judge, so stages passed on health checks.')
                : t('Numbers come from the step judgements EchoPort recorded during this run.')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-warning-bg p-3 text-warning-fg">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p className="text-body-medium">
            {plan.status === 'ROLLED_BACK'
              ? t('Rolled back to the source ({{reason}}).', {
                  reason: planFailureLabel(plan) ?? t('stopped'),
                })
              : t('This run ended as {{status}}.', { status: statusWord(plan.status) })}{' '}
            {plan.errorMessage}
          </p>
        </div>
      )}

      <div className="flex gap-3 max-compact:flex-col">
        <Kpi
          label={t('Failed requests')}
          value={failed}
          tone={failed === 0 ? 'success' : failed ? 'danger' : undefined}
          caption={t('{{n}} requests judged', { n: requests })}
        />
        <Kpi
          label={t('Missing · duplicate rows')}
          value={rows?.text ?? null}
          tone={rows ? (rows.clean ? 'success' : 'danger') : undefined}
          caption={
            rows
              ? t('{{n}} rows compared', { n: rows.rowsTotal ?? '—' })
              : writePauseCaption(plan, now)
          }
        />
        <Kpi
          label={t('Write pause')}
          value={writePauseText(plan)}
          caption={writePauseCaption(plan, now)}
        />
        <Kpi
          label={t('Total time')}
          value={total === null ? null : duration(total)}
          caption={t('planned {{duration}}', { duration: duration(plan.expectedSeconds) })}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Stage')}</TableHead>
              <TableHead>{t('Started')}</TableHead>
              <TableHead>{t('Duration')}</TableHead>
              <TableHead>{t('Result')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.steps.map((step) => {
              const took = stepSeconds(step);
              return (
                <TableRow key={step.index}>
                  <TableCell>{stepName(step)}</TableCell>
                  <TableCell className="font-mono text-mono">
                    {clock(step.result?.startedAt)}
                  </TableCell>
                  <TableCell className="font-mono text-mono">
                    {took === null ? '—' : `${took} s`}
                  </TableCell>
                  <TableCell className="text-fg-secondary">{stepResult(step)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-3 max-compact:flex-col">
        <Kpi
          label="RTO"
          value={total === null ? null : duration(total)}
          caption={t('planned evacuation, start → 100%')}
        />
        <Kpi
          label="RPO"
          value={null}
          caption={t('measured by the replication engine (infra #7)')}
        />
        <Kpi
          label={t('Max replication lag')}
          value={lag === null ? null : `${lag} s`}
          caption={t('data sync check')}
        />
      </div>
    </div>
  );
}
