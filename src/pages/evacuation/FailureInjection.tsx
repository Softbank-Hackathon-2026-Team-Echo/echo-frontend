import { FormField } from '@/components/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateMigrationPlan } from '@/lib/api/types';
import { k, t } from '@/lib/i18n';

export type Simulate = NonNullable<CreateMigrationPlan['simulate']>;
type Reason = Simulate['reason'];

// API 서버 24 simulate 표: 1·2·3·4·6·7 = 비율 단계, 5 = 데이터 확인
const REASONS: { value: Reason; label: string; steps: number[] }[] = [
  { value: 'ERROR_RATE', label: k('Too many 5xx on the target'), steps: [1, 2, 3, 4, 6, 7] },
  { value: 'TARGET_NOT_RECEIVING', label: k('Target receives no traffic'), steps: [1, 2] },
  { value: 'HEALTH', label: k('Health check fails'), steps: [1, 2, 3, 4, 6, 7] },
  { value: 'TRAFFIC', label: k('Traffic weight cannot be applied'), steps: [1, 2, 3, 4, 6, 7] },
  { value: 'DATA_LAG', label: k('Replication lag too high'), steps: [5] },
  {
    value: 'LOW_TRAFFIC',
    label: k('Quiet service (passes as low traffic)'),
    steps: [1, 2, 3, 4, 6, 7],
  },
];

const STEP_LABELS: Record<number, string> = {
  1: k('Step 1 · 5%'),
  2: k('Step 2 · 10%'),
  3: k('Step 3 · 25%'),
  4: k('Step 4 · 50%'),
  5: k('Step 5 · data sync check'),
  6: k('Step 6 · 75%'),
  7: k('Step 7 · 100%'),
};

const NONE = 'none';

/**
 * 데모용 실패 주입(가짜 실행기 모드에서만 서버가 받는다, F9 자동 롤백 시연). 이유와 단계는 서버 표에 맞는 짝만 고른다
 */
export function FailureInjection({
  value,
  onChange,
  error,
  unavailableReason,
}: {
  value: Simulate | null;
  onChange: (value: Simulate | null) => void;
  error?: string;
  /** 실제 실행기라 서버가 받지 않을 때 이유. 있으면 고르지 못한다 */
  unavailableReason?: string;
}) {
  const reason = REASONS.find((item) => item.value === value?.reason);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong p-3">
      <FormField
        id="plan-simulate-reason"
        label={t('Inject a failure (demo)')}
        hint={
          unavailableReason ??
          t('The run fails on purpose and rolls back to the source automatically.')
        }
        error={error}
      >
        <Select
          value={value?.reason ?? NONE}
          disabled={Boolean(unavailableReason)}
          onValueChange={(next) => {
            const picked = REASONS.find((item) => item.value === next);
            onChange(picked ? { reason: picked.value, failAtStep: picked.steps[0] ?? 1 } : null);
          }}
        >
          <SelectTrigger id="plan-simulate-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('No failure')}</SelectItem>
            {REASONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {value && reason && (
        <FormField id="plan-simulate-step" label={t('At step')}>
          <Select
            value={String(value.failAtStep)}
            onValueChange={(next) => onChange({ ...value, failAtStep: Number(next) })}
          >
            <SelectTrigger id="plan-simulate-step" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reason.steps.map((step) => (
                <SelectItem key={step} value={String(step)}>
                  {t(STEP_LABELS[step] ?? '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
    </div>
  );
}
