import { useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';
import { useCountUp } from './useCountUp';
import { useInView } from './useInView';

type Target = { value: number; format: (value: number) => string; title: string; note: string };

// 아직 잰 값이 아니라 리허설 목표다. 리허설에서 재면 이 값을 바꾸고 문구도 "Measured" 로 고친다
const TARGETS: Target[] = [
  { value: 0, format: String, title: 'failed requests', note: 'during a planned evacuation' },
  { value: 0, format: String, title: 'rows lost', note: 'writer cutover with LSN checks' },
  { value: 90, format: (v) => `≤ ${v} s`, title: 'traffic shift', note: '1 → 10 → 50 → 100%' },
  {
    value: 197,
    format: (v) => `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, '0')}s`,
    title: 'full evacuation',
    note: 'alert to 100% on the safe region',
  },
];

function TargetValue({ target, isActive }: { target: Target; isActive: boolean }) {
  const isReducedMotion = usePrefersReducedMotion();
  const value = useCountUp(target.value, isActive, isReducedMotion);
  return (
    <span className="text-headline whitespace-nowrap tabular-nums compact:text-stat">
      {/* 세는 중간 값은 읽지 않고 최종 값만 읽게 한다 */}
      <span aria-hidden>{target.format(value)}</span>
      <span className="sr-only">{target.format(target.value)}</span>
    </span>
  );
}

/** L01 ⑥ 목표 숫자. 리허설 측정 전이라 "목표"로 밝힌다 */
export function TargetNumbers() {
  const listRef = useRef<HTMLUListElement>(null);
  const isInView = useInView(listRef, 0.4);

  return (
    <section
      aria-labelledby="targets"
      className="mx-auto flex max-w-content flex-col gap-10 px-gutter py-20 max-compact:px-gutter-compact"
    >
      <h2 id="targets" className="font-mono text-mono text-fg-muted uppercase">
        Demo targets · to be replaced with rehearsal measurements
      </h2>
      <ul
        ref={listRef}
        className="grid grid-cols-4 max-compact:grid-cols-2 max-compact:gap-y-10 max-sm:grid-cols-1"
      >
        {TARGETS.map((target, index) => (
          <li
            key={target.title}
            className={cn(
              'flex flex-col gap-1.5 pr-6',
              index > 0 && 'border-l border-line pl-8',
              index === 2 && 'max-compact:border-l-0 max-compact:pl-0',
              index > 0 && 'max-sm:border-l-0 max-sm:pl-0',
            )}
          >
            <TargetValue target={target} isActive={isInView} />
            <span className="text-h3">{target.title}</span>
            <span className="text-small text-fg-muted">{target.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
