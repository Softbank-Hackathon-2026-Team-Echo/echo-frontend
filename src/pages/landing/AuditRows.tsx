import { Bot, CircleCheck, CircleX, Cpu, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROWS = [
  {
    actor: 'echoport',
    action: 'approved evacuation plan #42',
    avatar: <span className="text-label">EP</span>,
    avatarClass: 'bg-brand-subtle text-brand-on-subtle',
    result: <CircleCheck className="size-4 text-success-solid" />,
  },
  {
    actor: 'EchoPort Agent',
    action: 'proposed patch #3 on gcp-seoul',
    avatar: <Bot className="size-3.5" />,
    avatarClass: 'bg-ai-bg text-ai-fg',
    result: <Sparkles className="size-4 text-ai-solid" />,
  },
  {
    actor: 'System',
    action: 'auto-rolled back migration #41',
    avatar: <Cpu className="size-3.5" />,
    avatarClass: 'bg-subtle text-fg-secondary',
    result: <CircleX className="size-4 text-danger-solid" />,
  },
];

/** 감사 기록 줄 3개 (Figma Audit Item). 행위자 종류마다 아바타가 다르다 */
export function AuditRows({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col divide-y divide-line', className)}>
      {ROWS.map((row) => (
        <li key={row.actor} className="flex items-start gap-2.5 py-2.5">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full',
              row.avatarClass,
            )}
          >
            {row.avatar}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body">
              <span className="text-body-medium">{row.actor}</span> {row.action}
            </span>
            <span className="truncate font-mono text-mono text-fg-muted">
              12:03:58 · migration/42 · req 9f2c…
            </span>
          </span>
          {row.result}
        </li>
      ))}
    </ul>
  );
}
