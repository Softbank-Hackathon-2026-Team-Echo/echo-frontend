import { TrafficChart } from '@/components/TrafficChart';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import type { MigrationPlan } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import {
  currentWeights,
  failedRequests,
  latestP95,
  maxReplicationLag,
  weightTimeline,
} from '@/lib/migration-metrics';
import { Kpi } from './Kpi';

type Progress = NonNullable<MigrationPlan['progress']>;

/** 지금 비율 단계의 건수 판정 (API 서버 8-1 progress, 1초 폴링). "GCP 처리 14/50건 · 오류 0/허용 1" */
function StepProgress({
  progress,
  targetName,
  sourceName,
  now,
}: {
  progress: Progress;
  targetName: string;
  sourceName: string;
  now: number;
}) {
  const share = Math.min(
    100,
    Math.round((progress.requests / Math.max(1, progress.requiredRequests)) * 100),
  );
  const left = progress.deadlineAt
    ? Math.max(0, Math.ceil((Date.parse(progress.deadlineAt) - now) / 1000))
    : null;
  const overErrors = progress.errors5xx > progress.allowedErrors5xx;
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-migrating-solid bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-title">
          {t('Step {{step}} · {{weight}}% on {{target}}', {
            step: progress.step,
            weight: progress.targetWeight,
            target: targetName,
          })}
        </h2>
        {left !== null && (
          <span className="font-mono text-mono tabular-nums text-fg-muted">
            {t('{{seconds}}s left', { seconds: left })}
          </span>
        )}
      </header>
      <p className="text-body-medium tabular-nums">
        {t('{{target}} handled {{requests}} / {{required}} requests', {
          target: targetName,
          requests: progress.requests,
          required: progress.requiredRequests,
        })}{' '}
        ·{' '}
        <span className={overErrors ? 'text-danger-fg' : 'text-success-fg'}>
          {t('5xx {{errors}} / {{allowed}} allowed', {
            errors: progress.errors5xx,
            allowed: progress.allowedErrors5xx,
          })}
        </span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
        <span className="block h-full bg-migrating-solid" style={{ width: `${share}%` }} />
      </div>
      <p className="text-caption text-fg-muted">
        {t('{{source}} handled {{requests}} in the same window. Updated {{time}}.', {
          source: sourceName,
          requests: progress.sourceRequests,
          time: new Date(progress.updatedAt).toLocaleTimeString('en-GB'),
        })}
      </p>
    </section>
  );
}

/** M02 Live: A·B 비율 그래프 · 판정 숫자 · 지금 비율 · 롤백 조건 */
export function LiveTab({
  plan,
  sourceName,
  targetName,
  now,
}: {
  plan: MigrationPlan;
  sourceName: string;
  targetName: string;
  now: number;
}) {
  const weights = currentWeights(plan);
  const displayedTarget = useAnimatedNumber(weights.target);
  const displayedSource = 100 - displayedTarget;
  const failed = failedRequests(plan);
  const lag = maxReplicationLag(plan);
  const p95 = latestP95(plan);
  const next = plan.steps.find(
    (step) => step.kind === 'SHIFT' && step.result?.status === 'PENDING',
  );
  const conditions = plan.rollbackConditions;

  return (
    <div className="flex items-start gap-3 max-wide:flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-3 max-wide:w-full">
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-title">{t('Traffic · A vs B')}</h2>
            <span className="text-caption text-fg-muted">
              {t('Weights the entry point applied at each step')}
            </span>
          </header>
          <TrafficChart
            points={weightTimeline(plan, now)}
            sourceName={sourceName}
            targetName={targetName}
          />
        </section>
        <div className="flex gap-3 max-compact:flex-col">
          <Kpi
            label={t('Failed requests')}
            value={failed}
            tone={failed === 0 ? 'success' : failed ? 'danger' : undefined}
            caption={t('error rate × requests at each judged step')}
          />
          <Kpi
            label={t('Replication lag')}
            value={lag === null ? null : `${lag} s`}
            caption={t('rollback above {{seconds}} s', {
              seconds: conditions.maxReplicationLagSeconds,
            })}
          />
          <Kpi
            label={t('p95 (target)')}
            value={p95 === null ? null : `${p95} ms`}
            caption={
              conditions.p95Advisory
                ? t('advisory, does not fail a step')
                : t('rollback above {{ms}} ms', { ms: conditions.maxP95Ms })
            }
          />
        </div>
      </div>

      <div className="flex w-100 shrink-0 flex-col gap-3 max-wide:w-full">
        {plan.progress && (
          <StepProgress
            progress={plan.progress}
            targetName={targetName}
            sourceName={sourceName}
            now={now}
          />
        )}
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-title">{t('Traffic weight')}</h2>
          <div className="flex items-center justify-between gap-2 text-small text-fg-secondary">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-chart-3" />
              {sourceName}{' '}
              <span className="text-body-medium text-fg tabular-nums">{displayedSource}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-chart-1" />
              {targetName}{' '}
              <span className="text-body-medium text-fg tabular-nums">{displayedTarget}%</span>
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full" aria-hidden>
            <span
              className="min-w-0 basis-0 bg-chart-3 transition-[flex-grow] duration-700 ease-out motion-reduce:transition-none"
              style={{ flexGrow: weights.source }}
            />
            <span
              className="min-w-0 basis-0 bg-chart-1 transition-[flex-grow] duration-700 ease-out motion-reduce:transition-none"
              style={{ flexGrow: weights.target }}
            />
          </div>
          <p className="text-caption text-fg-secondary">
            {next
              ? t(
                  'Next step to {{source}} / {{target}} once {{name}} handles {{requests}} requests (within {{seconds}}s)',
                  {
                    source: next.sourceWeight ?? '—',
                    target: next.targetWeight ?? '—',
                    name: targetName,
                    requests: next.requiredRequests ?? '—',
                    seconds: next.maxWaitSeconds ?? plan.maxWaitSeconds,
                  },
                )
              : plan.status === 'SUCCEEDED'
                ? t('{{target}} now serves all traffic.', { target: targetName })
                : t('No traffic step left.')}
          </p>
        </section>
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <h2 className="text-title">{t('Automatic rollback when')}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-small">
            <li>{t('error rate > {{percent}}%', { percent: conditions.maxErrorRatePercent })}</li>
            {!conditions.p95Advisory && (
              <li>{t('p95 latency > {{ms}} ms', { ms: conditions.maxP95Ms })}</li>
            )}
            <li>{t('the target does not receive traffic while the source still does')}</li>
            <li>
              {t('replication lag > {{seconds}} s', {
                seconds: conditions.maxReplicationLagSeconds,
              })}
            </li>
            {conditions.healthCheck && <li>{t('the health check fails')}</li>}
          </ul>
          <p className="text-caption text-fg-muted">
            {t(
              'DB writer cutover (pause writes → fence → LSN match → promote) joins these steps when the data migration engine is connected.',
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
