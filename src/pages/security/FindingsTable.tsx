import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SecurityControl, SecurityFinding } from '@/lib/api/security';
import { securitySeverityLabel } from '@/lib/status';

type FindingsTableProps = {
  findings: SecurityFinding[];
  names: Map<string, string>;
  onSelect: (environmentId: string, control: SecurityControl) => void;
};

/** 클라우드별 결과를 공통 모양으로 맞춘 표 */
export function FindingsTable({ findings, names, onSelect }: FindingsTableProps) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No findings"
        description="Every collected control passed on every environment."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Finding</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Severity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <TableRow key={finding.id}>
              <TableCell>
                <button
                  type="button"
                  className="cursor-pointer text-left hover:underline"
                  onClick={() => onSelect(finding.environmentId, finding.control)}
                >
                  {finding.title}
                </button>
              </TableCell>
              <TableCell>{names.get(finding.environmentId) ?? finding.environmentId}</TableCell>
              <TableCell className="font-mono text-mono">{finding.source}</TableCell>
              <TableCell className="text-fg-secondary">
                {securitySeverityLabel(finding.severity)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
