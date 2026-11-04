import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Cell = 'pass' | 'violation' | 'issues';

const COLUMNS = ['IAM', k('Encryption'), k('Audit log'), k('Policy')];
const ROWS: { name: string; cells: Cell[] }[] = [
  { name: 'aws-tokyo-prod', cells: ['pass', 'pass', 'pass', 'pass'] },
  { name: 'gcp-seoul-standby', cells: ['pass', 'pass', 'violation', 'issues'] },
  { name: 'onprem-fukuoka', cells: ['issues', 'pass', 'pass', 'pass'] },
];

const CELL = {
  pass: { label: k('Pass'), icon: CircleCheck, className: 'bg-success-bg text-success-fg' },
  violation: { label: k('Violation'), icon: CircleX, className: 'bg-danger-bg text-danger-fg' },
  issues: { label: k('2 issues'), icon: TriangleAlert, className: 'bg-warning-bg text-warning-fg' },
} as const;

/** 보안 매트릭스 그림: 환경 × 항목. 대상이 출발지보다 약하면 이전이 막힌다 */
export function SecurityMatrix() {
  return (
    <table className="w-full border-separate border-spacing-1.5 text-left">
      <thead>
        <tr>
          <th className="w-36 max-sm:w-auto" />
          {COLUMNS.map((column) => (
            <th key={column} className="text-caption font-normal text-fg-secondary">
              {t(column)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.name}>
            <th className="pr-2 font-mono text-mono font-normal">{row.name}</th>
            {row.cells.map((cell, index) => {
              const view = CELL[cell];
              const Icon = view.icon;
              return (
                <td
                  key={COLUMNS[index]}
                  className={cn('rounded-md px-2 py-2 text-center text-label', view.className)}
                >
                  <span className="inline-flex items-center gap-1">
                    <Icon aria-hidden className="size-3.5" />
                    {/* 좁은 화면에서는 아이콘만 남겨 표가 넘치지 않게 한다 */}
                    <span className="max-sm:hidden">{t(view.label)}</span>
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
