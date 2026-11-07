import { Check, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StageState = 'done' | 'current' | 'failed' | 'pending' | 'skipped';

export type Stage = {
  key: string;
  title: ReactNode;
  meta?: ReactNode;
  state: StageState;
  /** 사람이 봐야 하는 단계에 붙는 빨간 배지 문구 (예: DB 쓰기 전환 결과 모름) */
  alert?: string;
};

const INDICATOR: Record<StageState, string> = {
  done: 'bg-success-solid text-fg-on-brand',
  current:
    'bg-migrating-solid text-fg-on-brand ring-4 ring-migrating-solid/25 motion-safe:animate-pulse',
  failed: 'bg-danger-solid text-fg-on-brand',
  pending: 'border border-line-strong bg-subtle text-fg-muted',
  skipped: 'border border-line bg-subtle text-fg-muted opacity-60',
};

/** 세로 단계 목록 (Figma Stage Step). 지금 단계는 남색 테두리가 깜빡인다 */
export function StageList({ stages, start = 0 }: { stages: Stage[]; start?: number }) {
  return (
    <ol className="flex flex-col gap-3">
      {stages.map((stage, index) => (
        <li
          key={stage.key}
          className="flex items-start gap-2.5"
          aria-current={stage.state === 'current' ? 'step' : undefined}
        >
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-label',
              INDICATOR[stage.state],
            )}
          >
            {stage.state === 'done' ? (
              <Check aria-hidden className="size-3.5" />
            ) : stage.state === 'current' ? (
              <LoaderCircle aria-hidden className="size-3.5" />
            ) : stage.state === 'failed' ? (
              <X aria-hidden className="size-3.5" />
            ) : (
              start + index + 1
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                'text-body-medium',
                stage.state === 'pending' || stage.state === 'skipped'
                  ? 'text-fg-secondary'
                  : 'text-fg',
              )}
            >
              {stage.title}
              {stage.alert && (
                <span className="ml-2 inline-flex items-center rounded-sm bg-danger-solid px-2 py-0.5 align-middle text-label text-fg-on-brand">
                  {stage.alert}
                </span>
              )}
            </span>
            {stage.meta && (
              <span
                className={cn(
                  'text-caption',
                  stage.state === 'current'
                    ? 'text-migrating-fg'
                    : stage.state === 'failed'
                      ? 'text-danger-fg'
                      : 'text-fg-muted',
                )}
              >
                {stage.meta}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
