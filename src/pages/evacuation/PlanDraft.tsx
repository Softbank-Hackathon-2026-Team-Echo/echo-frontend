import { type FormEvent, useState } from 'react';
import { FormError, FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { Input } from '@/components/ui/input';
import { fieldErrors, formErrorMessage } from '@/lib/api/form-errors';
import { useCreateMigrationPlan } from '@/lib/api/migrations';
import type { MigrationPlan } from '@/lib/api/types';
import {
  DEFAULT_CONDITIONS,
  DEFAULT_OBSERVE_SECONDS,
  draftSteps,
  duration,
  planStages,
} from './plan-stages';
import { StageList } from './StageList';
import { WizardSteps } from './WizardSteps';

const FIELDS = [
  'observeSeconds',
  'rollbackConditions.maxErrorRatePercent',
  'rollbackConditions.maxP95Ms',
  'rollbackConditions.maxReplicationLagSeconds',
] as const;

type PlanDraftProps = {
  orgId: string;
  serviceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
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
  orgId,
  serviceId,
  targetId,
  sourceName,
  targetName,
  onCreated,
}: PlanDraftProps) {
  const create = useCreateMigrationPlan(orgId, serviceId);
  const [observeSeconds, setObserveSeconds] = useState(DEFAULT_OBSERVE_SECONDS);
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const errors = fieldErrors(create.error);
  const steps = draftSteps(observeSeconds);
  const total = steps.reduce((sum, step) => sum + step.expectedSeconds, 0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { targetEnvironmentId: targetId, observeSeconds, rollbackConditions: conditions },
      { onSuccess: onCreated },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <PageHeader
        title="Plan the migration"
        description={`${sourceName} → ${targetName} · est. ${duration(total)} · approval needed within 24 hours`}
        actions={
          <RoleButton requires="DEVELOPER" type="submit" disabled={create.isPending}>
            Create plan
          </RoleButton>
        }
      />
      <WizardSteps current={2} />
      <FormError message={formErrorMessage(create.error, FIELDS)} />
      <div className="flex items-start gap-3 max-wide:flex-col">
        <section className="flex flex-1 flex-col gap-3.5 rounded-xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">Stages</h2>
          <StageList stages={planStages(steps, conditions, targetName)} />
        </section>
        <section className="flex w-96 shrink-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 max-wide:w-full">
          <h2 className="text-title">Automatic rollback when</h2>
          <NumberField
            id="plan-error-rate"
            label="Error rate above (%)"
            step="0.1"
            value={conditions.maxErrorRatePercent}
            error={errors['rollbackConditions.maxErrorRatePercent']}
            onChange={(value) => setConditions({ ...conditions, maxErrorRatePercent: value })}
          />
          <NumberField
            id="plan-p95"
            label="p95 latency above (ms)"
            value={conditions.maxP95Ms}
            error={errors['rollbackConditions.maxP95Ms']}
            onChange={(value) => setConditions({ ...conditions, maxP95Ms: value })}
          />
          <NumberField
            id="plan-lag"
            label="Replication lag above (s)"
            step="0.1"
            value={conditions.maxReplicationLagSeconds}
            error={errors['rollbackConditions.maxReplicationLagSeconds']}
            onChange={(value) => setConditions({ ...conditions, maxReplicationLagSeconds: value })}
          />
          <NumberField
            id="plan-observe"
            label="Watch each traffic step for (s)"
            value={observeSeconds}
            error={errors.observeSeconds}
            onChange={setObserveSeconds}
          />
          <p className="text-caption text-fg-muted">A failed health check always rolls back.</p>
        </section>
      </div>
    </form>
  );
}
