import { Bot, CircleCheck, CircleX, Cpu, Sparkles } from 'lucide-react';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// 행위자와 행동은 표의 두 칸이다. 번역도 문장으로 잇지 않고 '대피 계획 #42 승인' 처럼 행동만 적는다.
// echoport 는 계정 이름이라 번역이 없고 그대로 나온다
const ROWS = [
  {
    actor: 'echoport',
    action: k('approved evacuation plan #42'),
    avatar: <span className="text-label">EP</span>,
    avatarClass: 'bg-brand-subtle text-brand-on-subtle',
    result: <CircleCheck className="size-4 text-success-solid" />,
  },
  {
    actor: k('EchoPort Agent'),
    action: k('proposed patch #3 on gcp-seoul'),
    avatar: <Bot className="size-3.5" />,
    avatarClass: 'bg-ai-bg text-ai-fg',
    result: <Sparkles className="size-4 text-ai-solid" />,
  },
  {
    actor: k('System'),
    action: k('auto-rolled back migration #41'),
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
              <span className="text-body-medium">{t(row.actor)}</span> {t(row.action)}
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
