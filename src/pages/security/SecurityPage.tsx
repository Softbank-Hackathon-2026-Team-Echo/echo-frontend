import { Server } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { RoleButton } from '@/components/RoleButton';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEnvironments } from '@/lib/api/environments';
import { useCurrentOrg } from '@/lib/api/me';
import {
  cellFindingIds,
  useSecurityExceptions,
  useSecurityFindings,
  useSecurityFindingsByIds,
  useSecurityMatrix,
} from '@/lib/api/security';
import { dateTime } from '@/lib/format';
import { k, t } from '@/lib/i18n';
import { securityControlLabel } from '@/lib/status';
import { CompareTab } from './CompareTab';
import { ExceptionsTable } from './ExceptionsTable';
import { type FindingSelection, FindingSheet } from './FindingSheet';
import { FindingsTable } from './FindingsTable';
import { SecurityMatrixTable } from './SecurityMatrixTable';

const HEADERS: Record<string, { title: string; description: string }> = {
  matrix: {
    title: k('Security matrix'),
    description: k('Same policy on every environment. Click a cell for evidence.'),
  },
  compare: {
    title: k('Compare environments'),
    description: k('Pick any two environments. The same table is shown inside the migration plan.'),
  },
  findings: {
    title: k('Findings'),
    description: k('Results from every scanner in one shape.'),
  },
  exceptions: {
    title: k('Security exceptions'),
    description: k('A control can stop blocking for up to 7 days, with a reason and an approval.'),
  },
};

/** SEC 보안: Matrix · Compare · Findings */
export default function SecurityPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const matrix = useSecurityMatrix(orgId);
  const findings = useSecurityFindings(orgId);
  const exceptions = useSecurityExceptions(orgId);
  const [tab, setTab] = useState('matrix');
  const [selected, setSelected] = useState<FindingSelection | null>(null);
  const selectedRow =
    selected?.kind === 'cell'
      ? matrix.data?.rows.find((row) => row.environmentId === selected.environmentId)
      : undefined;
  const selectedCell = selected?.kind === 'cell' ? selectedRow?.cells[selected.control] : undefined;
  const cellFindings = useSecurityFindingsByIds(orgId, cellFindingIds(selectedCell));

  if (environments.isError) {
    return <ErrorState error={environments.error} onRetry={() => environments.refetch()} />;
  }
  if (!organization || environments.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const items = environments.data.items;
  const names = new Map(items.map((item) => [item.id, item.name]));
  const rows = matrix.data?.rows ?? [];
  const cells = rows.flatMap((row) => Object.values(row.cells));
  const controlTitles = new Map(
    cells.flatMap((cell) => cell.controls.map((item) => [item.controlId, item.title] as const)),
  );
  const serviceNames = new Map(
    rows.flatMap((row) => row.services.map((item) => [item.serviceId, item.name] as const)),
  );
  const header = HEADERS[tab] ?? HEADERS.matrix;
  const sheetTitle = (() => {
    if (selected?.kind === 'finding') {
      const { controlId } = selected.finding;
      return controlTitles.get(controlId) ?? controlId;
    }
    if (!selected) return '';
    return `${selectedRow?.environmentName ?? ''} · ${securityControlLabel(selected.control)}`;
  })();
  const hasSimulated = tab === 'compare' || cells.some((cell) => cell.mode === 'SIMULATED');
  const findingsTable = findings.isError ? (
    <ErrorState error={findings.error} onRetry={() => findings.refetch()} />
  ) : findings.isPending ? (
    <Skeleton className="h-40" />
  ) : (
    <FindingsTable
      findings={findings.data.items}
      total={findings.data.total}
      names={names}
      controlTitles={controlTitles}
      serviceNames={serviceNames}
      onSelect={(finding) => setSelected({ kind: 'finding', finding })}
    />
  );

  return (
    <>
      <PageHeader
        title={t(header?.title ?? k('Security'))}
        description={header && t(header.description)}
        actions={
          <RoleButton requires="DEVELOPER" disabledReason={t('Scans run with each deploy')}>
            {t('Re-scan all')}
          </RoleButton>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Server}
          title={t('No environments yet')}
          description={t('Register an environment to see its security checks.')}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={`/o/${organization.slug}/settings/environments`}>
                {t('Add environment')}
              </Link>
            </Button>
          }
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="matrix">{t('Matrix')}</TabsTrigger>
              <TabsTrigger value="compare">{t('Compare')}</TabsTrigger>
              <TabsTrigger value="findings">{t('Findings')}</TabsTrigger>
              <TabsTrigger value="exceptions">{t('Exceptions')}</TabsTrigger>
            </TabsList>
            {hasSimulated && <SimulatedBadge />}
          </div>
          <TabsContent value="matrix" className="mt-3 flex flex-col gap-3">
            {matrix.isError ? (
              <ErrorState error={matrix.error} onRetry={() => matrix.refetch()} />
            ) : matrix.isPending ? (
              <Skeleton className="h-48" />
            ) : (
              <>
                <SecurityMatrixTable
                  rows={rows}
                  onSelect={(environmentId, control) =>
                    setSelected({ kind: 'cell', environmentId, control })
                  }
                />
                <p className="text-caption text-fg-muted">
                  {t('Policy {{version}} · checked {{time}}', {
                    version: matrix.data.policyVersion,
                    time: dateTime(matrix.data.checkedAt),
                  })}
                  {' · '}
                  {t('Preparation checks only. The migration gate adds execution checks.')}
                </p>
              </>
            )}
            {findingsTable}
          </TabsContent>
          <TabsContent value="compare" className="mt-3">
            <CompareTab orgId={organization.id} environments={items} />
          </TabsContent>
          <TabsContent value="findings" className="mt-3">
            {findingsTable}
          </TabsContent>
          <TabsContent value="exceptions" className="mt-3">
            {exceptions.isError ? (
              <ErrorState error={exceptions.error} onRetry={() => exceptions.refetch()} />
            ) : exceptions.isPending ? (
              <Skeleton className="h-40" />
            ) : (
              <ExceptionsTable
                exceptions={exceptions.data.items}
                total={exceptions.data.total}
                names={names}
                controlTitles={controlTitles}
                serviceNames={serviceNames}
              />
            )}
          </TabsContent>
        </Tabs>
      )}
      <FindingSheet
        open={selected !== null}
        title={sheetTitle}
        cell={selectedCell}
        findings={
          selected?.kind === 'finding' ? [selected.finding] : (cellFindings.data?.items ?? [])
        }
        isLoading={cellFindings.isLoading}
        serviceNames={serviceNames}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
