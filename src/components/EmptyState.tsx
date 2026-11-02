import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-subtle text-fg-muted">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-title">{title}</p>
        {description && <p className="max-w-sm text-small text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
