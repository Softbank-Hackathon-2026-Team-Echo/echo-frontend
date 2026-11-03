import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 이전 화면의 숫자 칸. 값이 없으면 지어내지 않고 — 와 출처를 적는다 */
export function Kpi({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
      <span className="text-label text-fg-secondary">{label}</span>
      <span
        className={cn(
          'text-metric-xl tabular-nums',
          value === null || value === undefined ? 'text-fg-muted' : '',
          tone === 'success' && 'text-success-fg',
          tone === 'danger' && 'text-danger-fg',
        )}
      >
        {value ?? '—'}
      </span>
      {caption && <span className="text-caption text-fg-muted">{caption}</span>}
    </div>
  );
}
