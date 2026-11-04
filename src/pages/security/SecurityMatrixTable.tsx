import { SecurityCheckCell } from '@/components/SecurityCheckCell';
import {
  SECURITY_CONTROLS,
  type SecurityControl,
  type SecurityMatrixRow,
} from '@/lib/api/security';
import { t } from '@/lib/i18n';
import { securityControlLabel } from '@/lib/status';

type SecurityMatrixTableProps = {
  rows: SecurityMatrixRow[];
  names: Map<string, string>;
  onSelect: (environmentId: string, control: SecurityControl) => void;
};

/** 환경 × 4항목. 빈칸이 없고 미수집은 Unknown 이다. 칸을 누르면 근거가 열린다 */
export function SecurityMatrixTable({ rows, names, onSelect }: SecurityMatrixTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-2">
      <table className="w-full border-separate border-spacing-2 text-left">
        <thead>
          <tr>
            <th scope="col" className="w-40 text-caption font-normal text-fg-muted">
              {t('Environment')}
            </th>
            {SECURITY_CONTROLS.map((control) => (
              <th key={control} scope="col" className="text-caption font-normal text-fg-muted">
                {securityControlLabel(control)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = names.get(row.environmentId) ?? row.environmentId;
            return (
              <tr key={row.environmentId}>
                <th scope="row" className="text-body-medium font-normal whitespace-nowrap">
                  {name}
                </th>
                {SECURITY_CONTROLS.map((control) => (
                  <td key={control} className="min-w-28">
                    <SecurityCheckCell
                      cell={row.cells[control]}
                      label={`${name} ${securityControlLabel(control)}`}
                      onClick={() => onSelect(row.environmentId, control)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
