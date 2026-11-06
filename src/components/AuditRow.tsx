import { Bot, Cpu, User } from 'lucide-react';
import { Link } from 'react-router';
import type { AuditLog } from '@/lib/api/types';
import { auditActionLabel, auditActorName, auditResultView } from '@/lib/audit';
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SimulatedBadge } from './SimulatedBadge';
import { StatusBadge } from './StatusBadge';

const AVATARS = {
  USER: { icon: User, className: 'bg-brand-subtle text-brand-on-subtle' },
  AGENT: { icon: Bot, className: 'bg-ai-bg text-ai-fg' },
  SYSTEM: { icon: Cpu, className: 'bg-subtle text-fg-secondary' },
};

/** 감사 기록 한 줄. AUD 화면과 대시보드 최근 활동이 같이 쓴다 */
export function AuditRow({
  log,
  to,
  onNavigate,
}: {
  log: AuditLog;
  /** 있으면 줄을 눌러 그 일이 일어난 곳으로 간다 */
  to?: string;
  onNavigate?: () => void;
}) {
  const avatar = AVATARS[log.actor.type] ?? AVATARS.SYSTEM;
  const Icon = avatar.icon;
  const action = auditActionLabel(log.action);
  const meta = [
    dateTime(log.at),
    log.actor.component,
    log.reason,
    log.requestId && `req ${log.requestId.slice(0, 8)}`,
  ].filter(Boolean);

  const content = (
    <>
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          avatar.className,
        )}
      >
        <Icon aria-hidden className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-body break-words">
          <span className="text-body-medium">{auditActorName(log.actor)}</span>{' '}
          {action ?? <span className="font-mono text-mono">{log.action}</span>}
          {log.target?.label && <span className="text-fg-secondary"> · {log.target.label}</span>}
        </p>
        <p
          className="truncate font-mono text-mono text-fg-muted"
          title={log.requestId ?? undefined}
        >
          {meta.join(' · ')}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {log.details.simulated === true && <SimulatedBadge />}
        <StatusBadge {...auditResultView(log.result)} />
      </span>
    </>
  );

  return to ? (
    <li>
      <Link
        to={to}
        onClick={onNavigate}
        className="flex items-start gap-2.5 rounded-md py-2.5 hover:bg-subtle"
      >
        {content}
      </Link>
    </li>
  ) : (
    <li className="flex items-start gap-2.5 py-2.5">{content}</li>
  );
}
