import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SecurityFinding } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { securityResultView } from '@/lib/status';

type FindingsTableProps = {
  findings: SecurityFinding[];
  total: number;
  names: Map<string, string>;
  controlTitles: Map<string, string>;
  serviceNames: Map<string, string>;
  onSelect: (finding: SecurityFinding) => void;
};

/** 검사 도구별 결과를 공통 모양으로 맞춘 표. 통과한 증거도 있다 */
export function FindingsTable({
  findings,
  total,
  names,
  controlTitles,
  serviceNames,
  onSelect,
}: FindingsTableProps) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t('No evidence yet')}
        description={t('Scanner results appear here after the first build or check.')}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Control')}</TableHead>
              <TableHead>{t('Environment')}</TableHead>
              <TableHead>{t('Service')}</TableHead>
              <TableHead>{t('Source')}</TableHead>
              <TableHead>{t('Result')}</TableHead>
              <TableHead>{t('Collected')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => (
              <TableRow key={finding.id}>
                <TableCell>
                  <button
                    type="button"
                    className="cursor-pointer text-left hover:underline"
                    onClick={() => onSelect(finding)}
                  >
                    {controlTitles.get(finding.controlId) ?? finding.controlId}
                  </button>
                  <span className="ml-2 font-mono text-mono text-fg-muted">
                    {finding.controlId}
                  </span>
                </TableCell>
                <TableCell>{names.get(finding.environmentId ?? '') ?? '—'}</TableCell>
                <TableCell>{serviceNames.get(finding.serviceId ?? '') ?? '—'}</TableCell>
                <TableCell className="font-mono text-mono">{finding.source}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge {...securityResultView(finding.result)} />
                    {finding.mode === 'SIMULATED' && <SimulatedBadge />}
                  </span>
                </TableCell>
                <TableCell className="text-fg-secondary">{dateTime(finding.collectedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > findings.length && (
        <p className="text-caption text-fg-muted">
          {t('Showing the latest {{shown}} of {{total}}', { shown: findings.length, total })}
        </p>
      )}
    </div>
  );
}
