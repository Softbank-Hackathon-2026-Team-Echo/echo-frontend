import { CircleCheck, CircleHelp, CircleX, type LucideIcon, TriangleAlert } from 'lucide-react';
import type { SecurityCell } from '@/lib/api/security';
import { securityCellLabel, securityResultView, type Tone } from '@/lib/status';
import { cn } from '@/lib/utils';

const TONE: Partial<Record<Tone, { className: string; icon: LucideIcon }>> = {
  success: { className: 'bg-success-bg text-success-fg', icon: CircleCheck },
  warning: { className: 'bg-warning-bg text-warning-fg', icon: TriangleAlert },
  danger: { className: 'bg-danger-bg text-danger-fg', icon: CircleX },
};
const NEUTRAL = { className: 'bg-subtle text-fg-muted', icon: CircleHelp };

type SecurityCheckCellProps = {
  cell: SecurityCell;
  /** 있으면 눌러서 근거를 연다 */
  onClick?: () => void;
  /** 누를 수 있을 때 읽어 주는 이름 (환경 · 항목) */
  label?: string;
};

/** 보안 칸 하나. 매트릭스와 이전 전후 비교가 같이 쓴다 */
export function SecurityCheckCell({ cell, onClick, label }: SecurityCheckCellProps) {
  const view = TONE[securityResultView(cell.result).tone] ?? NEUTRAL;
  const Icon = view.icon;
  const text = securityCellLabel(cell.result, cell.findingCount);
  const className = cn(
    'flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-label',
    view.className,
  );
  const content = (
    <>
      <Icon aria-hidden className="size-3.5" />
      {text}
    </>
  );
  if (!onClick) return <span className={className}>{content}</span>;
  return (
    <button
      type="button"
      aria-label={`${label}: ${text}`}
      onClick={onClick}
      className={cn(
        className,
        'cursor-pointer outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus',
      )}
    >
      {content}
    </button>
  );
}
