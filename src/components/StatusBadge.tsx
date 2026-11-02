import type { StatusView, Tone } from '@/lib/status';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-subtle text-fg-muted',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  migrating: 'bg-migrating-bg text-migrating-fg',
  ai: 'bg-ai-bg text-ai-fg',
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: 'bg-fg-muted',
  success: 'bg-success-solid',
  warning: 'bg-warning-solid',
  danger: 'bg-danger-solid',
  migrating: 'bg-migrating-solid',
  ai: 'bg-ai-solid',
};

type StatusBadgeProps = StatusView & { className?: string; title?: string };

export function StatusBadge({ label, tone, className, title }: StatusBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-label whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT_CLASSES[tone])} />
      {label}
    </span>
  );
}
