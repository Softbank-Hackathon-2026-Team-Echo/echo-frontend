import { cellIssueCount } from '@/lib/api/security';
import type { SecurityCompareRow, SecurityMatrixCell } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { securityCompareNote, securityControlLabel } from '@/lib/status';
import { cn } from '@/lib/utils';
import { SecurityCheckCell } from './SecurityCheckCell';

type SecurityCompareTableProps = {
  rows: SecurityCompareRow[];
  sourceName: string;
  targetName: string;
  /** 좁은 패널에서는 판정 칸을 빼고 막힌 이유를 위쪽 알림으로 보여 준다 */
  showResult?: boolean;
};

function CompareCell({ cell }: { cell: SecurityMatrixCell }) {
  return (
    <SecurityCheckCell
      cell={{ result: cell.result, findingCount: cellIssueCount(cell) }}
      waived={cell.gateStatus === 'WAIVED'}
    />
  );
}

/** 이전 전후 보안 비교 표. SEC Compare 탭과 E01-3 패널이 같이 쓴다 */
export function SecurityCompareTable({
  rows,
  sourceName,
  targetName,
  showResult = false,
}: SecurityCompareTableProps) {
  return (
    <div
      className={cn(
        'grid items-center gap-2',
        showResult ? 'grid-cols-[7rem_1fr_1fr_9rem]' : 'grid-cols-[7rem_1fr_1fr]',
      )}
    >
      <span className="text-caption text-fg-muted">{t('Control')}</span>
      <span className="truncate font-mono text-mono text-fg-muted">{sourceName}</span>
      <span className="truncate font-mono text-mono text-fg-muted">{targetName}</span>
      {showResult && <span className="text-caption text-fg-muted">{t('Result')}</span>}
      {rows.map((row) => (
        <div key={row.control} className="contents">
          <span className="text-body-medium">{securityControlLabel(row.control)}</span>
          <CompareCell cell={row.source} />
          <CompareCell cell={row.target} />
          {showResult && (
            <span
              className={cn(
                'text-small',
                row.blocksMigration ? 'text-danger-fg' : 'text-fg-secondary',
              )}
            >
              {securityCompareNote(row)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
