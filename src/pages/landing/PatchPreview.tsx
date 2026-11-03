import { CircleCheck } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINES = [
  { no: 41, sign: ' ', text: 'shared_buffers = 4GB', className: '' },
  { no: 42, sign: '−', text: 'max_connections = 100', className: 'bg-danger-bg text-danger-fg' },
  { no: 42, sign: '+', text: 'max_connections = 200', className: 'bg-success-bg text-success-fg' },
  { no: 43, sign: ' ', text: 'work_mem = 16MB', className: '' },
];

/** AI 사전 점검 패치 그림 (E01-2 PatchReview 와 같은 모양) */
export function PatchPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-col gap-1 p-3">
        <span className="flex items-center gap-2">
          <StatusBadge label="AI" tone="ai" />
          <span className="text-title">Patch #3 · postgresql.conf</span>
        </span>
        <span className="text-small text-fg-secondary">
          Feature gap: connection limit on GCP Cloud SQL is lower than AWS RDS. Raising it keeps
          peak traffic within capacity.
        </span>
      </div>
      <div className="bg-subtle py-1">
        {LINES.map((line) => (
          <div
            key={`${line.sign}${line.text}`}
            className={cn('flex gap-3 px-3 py-0.5 font-mono text-mono', line.className)}
          >
            <span className="w-5 text-right text-fg-muted">{line.no}</span>
            <span className="w-2">{line.sign}</span>
            <span>{line.text}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <span className="flex items-center gap-1.5 text-small text-success-fg">
          <CircleCheck aria-hidden className="size-4" />
          Sandbox verification passed (12/12)
        </span>
        <span className="flex gap-2">
          <span className={buttonVariants({ variant: 'outline', size: 'sm' })}>Reject</span>
          <span className={buttonVariants({ size: 'sm' })}>Approve patch</span>
        </span>
      </div>
    </div>
  );
}
