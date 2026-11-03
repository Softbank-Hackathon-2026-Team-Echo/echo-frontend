import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { cn } from '@/lib/utils';

export type CheckResult = 'PASS' | 'WARN' | 'FAIL';

type Row = { control: string; source: CheckResult; target: CheckResult; note?: string };

/**
 * 시뮬레이션: 보안 비교 API(계약 4-7 🆕, 보안 파트)가 생기기 전까지 고정 값을 보여 준다.
 * FAIL 이 하나라도 있으면 승인을 잠근다(Figma E01-3 메모 2). 데모가 막히지 않게 지금 값에는 FAIL 이 없다
 */
export const SECURITY_ROWS: Row[] = [
  { control: 'IAM', source: 'PASS', target: 'PASS' },
  { control: 'Encryption', source: 'PASS', target: 'PASS' },
  { control: 'Audit log', source: 'PASS', target: 'PASS' },
  { control: 'Policy', source: 'PASS', target: 'WARN', note: '2 issues' },
];

export function securityMismatches(rows: Row[] = SECURITY_ROWS) {
  return rows.filter((row) => row.target === 'FAIL');
}

const CELL = {
  PASS: { className: 'bg-success-bg text-success-fg', icon: CircleCheck, label: 'Pass' },
  WARN: { className: 'bg-warning-bg text-warning-fg', icon: TriangleAlert, label: 'Issues' },
  FAIL: { className: 'bg-danger-bg text-danger-fg', icon: CircleX, label: 'Violation' },
} as const;

function Cell({ result, note }: { result: CheckResult; note?: string }) {
  const view = CELL[result];
  const Icon = view.icon;
  return (
    <span
      className={cn(
        'flex h-10 items-center justify-center gap-1.5 rounded-md text-label',
        view.className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {result === 'WARN' && note ? note : view.label}
    </span>
  );
}

/** 이전 전후 보안 비교 (E01-3 오른쪽 패널) */
export function SecurityComparison({
  sourceName,
  targetName,
}: {
  sourceName: string;
  targetName: string;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-title">Security before / after</h2>
        <SimulatedBadge />
      </header>
      <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
        <span className="text-caption text-fg-muted">Control</span>
        <span className="truncate font-mono text-mono text-fg-muted">{sourceName}</span>
        <span className="truncate font-mono text-mono text-fg-muted">{targetName}</span>
        {SECURITY_ROWS.map((row) => (
          <div key={row.control} className="contents">
            <span className="text-small">{row.control}</span>
            <Cell result={row.source} />
            <Cell result={row.target} note={row.note} />
          </div>
        ))}
      </div>
    </section>
  );
}
