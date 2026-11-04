import { Check, LoaderCircle, Minus } from 'lucide-react';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const STEPS = [
  { title: k('Choose target'), meta: k('rule score') },
  { title: k('AI pre-check'), meta: k('sandbox test') },
  { title: k('Approve plan'), meta: k('Developer+') },
] as const;

const PRECHECK_STEP = 1;

/** E01 대피 마법사 단계 표시. current 는 0부터. 재난 없이 계획으로 바로 오면 점검을 돌리지 않았으니 완료로 그리지 않는다 */
export function WizardSteps({
  current,
  precheckSkipped = false,
}: {
  current: number;
  precheckSkipped?: boolean;
}) {
  return (
    <ol className="flex items-center gap-3 rounded-lg max-compact:flex-col max-compact:items-start border border-line bg-surface px-4 py-3">
      {STEPS.map((step, index) => {
        const skipped = precheckSkipped && index === PRECHECK_STEP;
        const state = skipped
          ? 'skipped'
          : index < current
            ? 'done'
            : index === current
              ? 'current'
              : 'pending';
        return (
          <li key={step.title} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden className="h-0.5 w-12 bg-line max-compact:hidden" />}
            <span
              className="flex items-start gap-2.5"
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-label',
                  state === 'current' &&
                    'bg-migrating-solid text-fg-on-brand ring-4 ring-migrating-solid/25 motion-safe:animate-pulse',
                  state === 'done' && 'bg-success-solid text-fg-on-brand',
                  (state === 'pending' || state === 'skipped') &&
                    'border border-line-strong bg-subtle text-fg-muted',
                )}
              >
                {state === 'current' ? (
                  <LoaderCircle aria-hidden className="size-3.5" />
                ) : state === 'done' ? (
                  <Check aria-hidden className="size-3.5" />
                ) : state === 'skipped' ? (
                  <Minus aria-hidden className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    'text-body-medium',
                    state === 'pending' || state === 'skipped' ? 'text-fg-secondary' : 'text-fg',
                  )}
                >
                  {t(step.title)}
                </span>
                <span
                  className={cn(
                    'text-caption',
                    state === 'current' ? 'text-migrating-fg' : 'text-fg-muted',
                  )}
                >
                  {skipped ? t('skipped') : t(step.meta)}
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
