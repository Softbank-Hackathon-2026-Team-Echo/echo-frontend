import { ExternalLink } from '@/components/ExternalLink';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { SecurityControl } from '@/lib/api/security';
import type { SecurityControlCheck, SecurityFinding, SecurityMatrixCell } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { securityReasonLabel, securityResultView, securitySeverityLabel } from '@/lib/status';

export type FindingSelection =
  | { kind: 'cell'; environmentId: string; control: SecurityControl }
  | { kind: 'finding'; finding: SecurityFinding };

type FindingSheetProps = {
  open: boolean;
  title: string;
  /** 칸을 눌렀을 때만 있다 */
  cell?: SecurityMatrixCell;
  findings: SecurityFinding[];
  isLoading: boolean;
  serviceNames: Map<string, string>;
  onClose: () => void;
};

function shortDigest(digest: string) {
  return digest.replace(/^sha256:/, '').slice(0, 12);
}

function FindingDetail({ finding }: { finding: SecurityFinding }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-subtle p-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge {...securityResultView(finding.result)} />
        <span className="font-mono text-mono">{finding.source}</span>
        {finding.toolVersion && (
          <span className="font-mono text-mono text-fg-muted">{finding.toolVersion}</span>
        )}
        {finding.mode === 'SIMULATED' && <SimulatedBadge />}
      </div>
      {finding.reason && <p className="font-mono text-mono break-all">{finding.reason}</p>}
      <p className="text-caption text-fg-muted">
        {t('collected {{time}} · expires {{expires}}', {
          time: dateTime(finding.collectedAt),
          expires: dateTime(finding.expiresAt),
        })}
        {finding.mode === 'CACHE' && ` · ${t('cached')}`}
      </p>
      {finding.imageDigest && (
        <p className="text-caption text-fg-muted">
          {t('Image')}{' '}
          <span className="font-mono" title={finding.imageDigest}>
            {shortDigest(finding.imageDigest)}
          </span>
        </p>
      )}
      {finding.evidenceRef && (
        <p className="font-mono text-mono break-all text-fg-muted">{finding.evidenceRef}</p>
      )}
      {finding.basisUrl && <ExternalLink href={finding.basisUrl} />}
      {finding.items.length > 0 && (
        <ul className="flex flex-col gap-0.5 font-mono text-mono">
          {finding.items.map((item) => (
            <li key={item.itemId} className="break-all">
              {item.severity ? `${securitySeverityLabel(item.severity)} · ` : ''}
              {item.itemId}
              {item.target ? ` · ${item.target}` : ''}
              {item.installedVersion
                ? ` · ${item.installedVersion} → ${item.fixedVersion ?? '—'}`
                : ''}
            </li>
          ))}
        </ul>
      )}
      {finding.totalItems > finding.items.length && (
        <p className="text-caption text-fg-muted">
          {t('Showing {{shown}} of {{total}} items', {
            shown: finding.items.length,
            total: finding.totalItems,
          })}
        </p>
      )}
    </div>
  );
}

function ControlCheck({
  control,
  findings,
  serviceName,
}: {
  control: SecurityControlCheck;
  findings: SecurityFinding[];
  serviceName: string | undefined;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-title">{control.title}</h3>
        <StatusBadge {...securityResultView(control.result)} />
      </div>
      <p className="text-small text-fg-secondary">
        <span className="font-mono">{control.controlId}</span> ·{' '}
        {control.isMandatory ? t('Required') : t('Optional')}
        {serviceName ? ` · ${serviceName}` : ''}
      </p>
      {control.reasons.length > 0 && (
        <p className="text-body">{control.reasons.map(securityReasonLabel).join(' · ')}</p>
      )}
      {findings.map((finding) => (
        <FindingDetail key={finding.id} finding={finding} />
      ))}
    </article>
  );
}

function emptyText(result: string | undefined) {
  if (result === 'UNKNOWN')
    return t('This control has not been collected yet, so it has no verdict.');
  if (result === 'NA') return t('This control does not apply to this environment.');
  return t('No findings. This control passed the last check.');
}

/** 칸이나 증거를 누르면 여는 근거. 칸은 통제마다 판정 사유와 증거를 같이 보여 준다 */
export function FindingSheet({
  open,
  title,
  cell,
  findings,
  isLoading,
  serviceNames,
  onClose,
}: FindingSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <div className="flex flex-col gap-4 p-6">
          <SheetHeader className="p-0">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{t('Evidence behind this cell.')}</SheetDescription>
          </SheetHeader>
          {cell && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <StatusBadge {...securityResultView(cell.result)} />
                {cell.hasException && (
                  <span className="text-small text-fg-secondary">{t('Exception applied')}</span>
                )}
                {cell.mode === 'SIMULATED' && <SimulatedBadge />}
              </div>
              {cell.checkedAt && (
                <p className="text-caption text-fg-muted">
                  {t('checked {{time}}', { time: dateTime(cell.checkedAt) })}
                </p>
              )}
            </div>
          )}
          {isLoading && <Skeleton className="h-24" />}
          {cell ? (
            cell.controls.length === 0 ? (
              <p className="text-body text-fg-secondary">{emptyText(cell.result)}</p>
            ) : (
              cell.controls.map((control) => (
                <ControlCheck
                  key={`${control.controlId}-${control.serviceId ?? 'environment'}`}
                  control={control}
                  findings={findings.filter((item) => control.findingIds.includes(item.id))}
                  serviceName={serviceNames.get(control.serviceId ?? '')}
                />
              ))
            )
          ) : (
            findings.map((finding) => <FindingDetail key={finding.id} finding={finding} />)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
