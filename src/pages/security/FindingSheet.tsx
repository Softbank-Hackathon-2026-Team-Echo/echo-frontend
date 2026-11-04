import { SimulatedBadge } from '@/components/SimulatedBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SecurityCell, SecurityControl, SecurityFinding } from '@/lib/api/security';
import { dateTime } from '@/lib/format';
import { securityControlLabel, securityResultView, securitySeverityLabel } from '@/lib/status';

export type FindingSelection = { environmentId: string; control: SecurityControl };

type FindingSheetProps = {
  environmentName: string;
  control: SecurityControl | undefined;
  cell: SecurityCell | undefined;
  findings: SecurityFinding[];
  onClose: () => void;
};

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption text-fg-muted">{label}</span>
      <pre className="overflow-x-auto rounded-md bg-subtle p-2 font-mono text-mono">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function emptyText(result: string | undefined) {
  if (result === 'UNKNOWN') return 'This control has not been collected yet, so it has no verdict.';
  if (result === 'NA') return 'This control does not apply to this environment.';
  return 'No findings. This control passed the last check.';
}

/** 칸을 누르면 여는 근거. 원본(evidence)과 공통 모양(normalized)을 같이 보여 준다 */
export function FindingSheet({
  environmentName,
  control,
  cell,
  findings,
  onClose,
}: FindingSheetProps) {
  return (
    <Sheet open={Boolean(control)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <div className="flex flex-col gap-4 p-6">
          <SheetHeader className="p-0">
            <SheetTitle>
              {environmentName} · {control ? securityControlLabel(control) : ''}
            </SheetTitle>
            <SheetDescription>Evidence behind this cell.</SheetDescription>
          </SheetHeader>
          <div className="flex items-center gap-2">
            {cell && <StatusBadge {...securityResultView(cell.result)} />}
            <SimulatedBadge />
          </div>
          {findings.length === 0 ? (
            <p className="text-body text-fg-secondary">{emptyText(cell?.result)}</p>
          ) : (
            findings.map((finding) => (
              <article
                key={finding.id}
                className="flex flex-col gap-2 rounded-lg border border-line p-3"
              >
                <h3 className="text-title">{finding.title}</h3>
                <p className="text-small text-fg-secondary">
                  {securitySeverityLabel(finding.severity)} ·{' '}
                  <span className="font-mono">{finding.source}</span> · checked{' '}
                  {dateTime(finding.checkedAt)}
                </p>
                <p className="text-body">{finding.suggestedFix}</p>
                <Json label="Normalized" value={finding.normalized} />
                <Json label="Evidence" value={finding.evidence} />
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
