import { ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SecurityException } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { securityExceptionStatusView, shortSha } from '@/lib/status';

type ExceptionsTableProps = {
  exceptions: SecurityException[];
  total: number;
  names: Map<string, string>;
  controlTitles: Map<string, string>;
  serviceNames: Map<string, string>;
};

/** 예외의 범위는 통제마다 다르다. 있는 칸만 잇는다 */
function scopeText(
  exception: SecurityException,
  names: Map<string, string>,
  serviceNames: Map<string, string>,
) {
  const parts = [
    exception.serviceId && (serviceNames.get(exception.serviceId) ?? exception.serviceId),
    exception.environmentId && (names.get(exception.environmentId) ?? exception.environmentId),
    exception.imageDigest?.replace(/^sha256:/, '').slice(0, 12),
    exception.configCommit && shortSha(exception.configCommit),
    exception.wasVersion,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t('Whole organization');
}

/** 기한부 예외 기록. 지우지 않으므로 철회·만료된 것도 남는다 */
export function ExceptionsTable({
  exceptions,
  total,
  names,
  controlTitles,
  serviceNames,
}: ExceptionsTableProps) {
  if (exceptions.length === 0) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={t('No exceptions')}
        description={t('Every control is judged as it is.')}
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
              <TableHead>{t('Scope')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Reason')}</TableHead>
              <TableHead>{t('Approved by')}</TableHead>
              <TableHead>{t('Expires')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exceptions.map((exception) => (
              <TableRow key={exception.id}>
                <TableCell>
                  <span className="flex flex-wrap items-baseline gap-2">
                    {controlTitles.get(exception.controlId)}
                    <span className="font-mono text-mono text-fg-muted">{exception.controlId}</span>
                  </span>
                </TableCell>
                <TableCell>{scopeText(exception, names, serviceNames)}</TableCell>
                <TableCell>
                  <StatusBadge {...securityExceptionStatusView(exception.status)} />
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal text-fg-secondary">
                  {exception.reason}
                </TableCell>
                <TableCell>{exception.approvedBy?.login ?? '—'}</TableCell>
                <TableCell className="text-fg-secondary">{dateTime(exception.expiresAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > exceptions.length && (
        <p className="text-caption text-fg-muted">
          {t('Showing the latest {{shown}} of {{total}}', { shown: exceptions.length, total })}
        </p>
      )}
    </div>
  );
}
