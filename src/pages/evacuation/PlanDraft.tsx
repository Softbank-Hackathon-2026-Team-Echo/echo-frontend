import { type FormEvent, useState } from 'react';
import { FormError, FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SharedTrafficNotice } from '@/components/SharedTrafficNotice';
import { StageList } from '@/components/StageList';
import { Input } from '@/components/ui/input';
import { fieldErrors, formErrorMessage } from '@/lib/api/form-errors';
import { useCreateMigrationPlan } from '@/lib/api/migrations';
import type { MigrationPlan } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import {
  DEFAULT_CONDITIONS,
  DEFAULT_MAX_WAIT_SECONDS,
  DEFAULT_REQUIRED_REQUESTS,
  draftSteps,
  duration,
  planStages,
} from '@/lib/migration-stages';
import { FailureInjection, type Simulate } from './FailureInjection';
import { WizardSteps } from './WizardSteps';

const FIELDS = [
  'requiredRequests',
  'maxWaitSeconds',
  'simulate',
  'rollbackConditions.maxErrorRatePercent',
  'rollbackConditions.maxP95Ms',
  'rollbackConditions.maxReplicationLagSeconds',
] as const;

type PlanDraftProps = {
  /** 복귀 버튼에서 왔다. 계획 종류는 서버가 정하고 이 값은 제목에만 쓴다 */
  failback: boolean;
  orgId: string;
  serviceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  /** 재난 반경 안 등으로 만들 수 없을 때 이유 */
  blockedReason?: string;
  /** 도착 환경이 실제 실행기로 배포됐으면 서버가 실패 주입을 거절한다 */
  realTarget: boolean;
  precheckSkipped: boolean;
  onCreated: (plan: MigrationPlan) => void;
};

function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  step = '1',
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  step?: string;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-invalid={Boolean(error)}
      />
    </FormField>
  );
}

/** E01-3 계획 만들기: 고정 단계를 미리 보고 롤백 조건을 정한다. 만들면 승인 대기(24시간)가 된다 */
export function PlanDraft({
  failback,
  orgId,
  serviceId,
  targetId,
  sourceName,
  targetName,
  blockedReason,
  realTarget,
  precheckSkipped,
  onCreated,
}: PlanDraftProps) {
  const create = useCreateMigrationPlan(orgId, serviceId);
  const [required, setRequired] = useState<number[]>([...DEFAULT_REQUIRED_REQUESTS]);
  const [maxWaitSeconds, setMaxWaitSeconds] = useState(DEFAULT_MAX_WAIT_SECONDS);
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [picked, setSimulate] = useState<Simulate | null>(null);
  const simulate = realTarget ? null : picked;
  const errors = fieldErrors(create.error);
  const steps = draftSteps(required, maxWaitSeconds);
  const total = steps.reduce((sum, step) => sum + step.expectedSeconds, 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        targetEnvironmentId: targetId,
        requiredRequests: required,
        maxWaitSeconds,
        rollbackConditions: conditions,
        ...(simulate ? { simulate } : {}),
      },
      { onSuccess: onCreated },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <PageHeader
        title={failback ? t('Plan the failback') : t('Plan the migration')}
        description={t(
          '{{source}} → {{target}} · est. {{duration}} · approval needed within 24 hours',
          {
            source: sourceName,
            target: targetName,
            duration: duration(total),
          },
        )}
        actions={
          <RoleButton
            requires="DEVELOPER"
            type="submit"
            disabledReason={blockedReason}
            disabled={create.isPending}
          >
            {t('Create plan')}
          </RoleButton>
        }
      />
      <WizardSteps current={2} precheckSkipped={precheckSkipped} />
      <SharedTrafficNotice orgId={orgId} />
      <FormError message={formErrorMessage(create.error, FIELDS)} />
      <div className="flex items-start gap-3 max-wide:flex-col">
        <section className="flex flex-1 flex-col gap-3 rounded-xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">{t('Stages')}</h2>
          <StageList stages={planStages(steps, conditions, targetName)} />
        </section>
        <section className="flex w-96 shrink-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">{t('Each traffic step passes when')}</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['10%', '50%', '100%'] as const).map((label, index) => (
              <NumberField
                key={label}
                id={`plan-required-${index}`}
                label={t('{{weight}} · requests', { weight: label })}
                value={required[index] ?? 0}
                error={index === 0 ? errors.requiredRequests : undefined}
                onChange={(value) =>
                  setRequired(required.map((item, at) => (at === index ? value : item)))
                }
              />
            ))}
          </div>
          <NumberField
            id="plan-max-wait"
            label={t('Wait at most per step (s)')}
            value={maxWaitSeconds}
            error={errors.maxWaitSeconds}
            onChange={setMaxWaitSeconds}
          />
          <p className="text-caption text-fg-muted">
            {t(
              '{{target}} has to handle that many requests. A quiet service passes as low traffic; if only {{source}} keeps receiving them, the step fails.',
              { target: targetName, source: sourceName },
            )}
          </p>
          <h2 className="pt-2 text-title">{t('Automatic rollback when')}</h2>
          <NumberField
            id="plan-error-rate"
            label={t('Error rate above (%)')}
            step="0.1"
            value={conditions.maxErrorRatePercent}
            error={errors['rollbackConditions.maxErrorRatePercent']}
            onChange={(value) => setConditions({ ...conditions, maxErrorRatePercent: value })}
          />
          <NumberField
            id="plan-p95"
            label={t('p95 latency above (ms, advisory)')}
            value={conditions.maxP95Ms}
            error={errors['rollbackConditions.maxP95Ms']}
            onChange={(value) => setConditions({ ...conditions, maxP95Ms: value })}
          />
          <NumberField
            id="plan-lag"
            label={t('Replication lag above (s)')}
            step="0.1"
            value={conditions.maxReplicationLagSeconds}
            error={errors['rollbackConditions.maxReplicationLagSeconds']}
            onChange={(value) => setConditions({ ...conditions, maxReplicationLagSeconds: value })}
          />
          <p className="text-caption text-fg-muted">
            {t(
              'A failed health check always rolls back. p95 is shown for reference and does not fail a step.',
            )}
          </p>
          <FailureInjection
            value={simulate}
            onChange={setSimulate}
            error={errors.simulate}
            unavailableReason={
              realTarget
                ? t(
                    'Not available: {{target}} runs on real executors, which refuse injected failures.',
                    { target: targetName },
                  )
                : undefined
            }
          />
        </section>
      </div>
    </form>
  );
}
