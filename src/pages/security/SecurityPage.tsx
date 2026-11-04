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
import { useSecurityFindings, useSecurityMatrix } from '@/lib/api/security';
import { k, t } from '@/lib/i18n';
import { CompareTab } from './CompareTab';
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
};

/** SEC 보안: Matrix · Compare · Findings */
export default function SecurityPage() {
  const { slug } = useParams();
  const { organization } = useCurrentOrg(slug);
  const orgId = organization?.id;
  const environments = useEnvironments(orgId);
  const matrix = useSecurityMatrix(orgId);
  const findings = useSecurityFindings(orgId);
  const [tab, setTab] = useState('matrix');
  const [selected, setSelected] = useState<FindingSelection | null>(null);

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
  const rows = matrix.data ?? [];
  const allFindings = findings.data ?? [];
  const select = (environmentId: string, control: FindingSelection['control']) =>
    setSelected({ environmentId, control });
  const header = HEADERS[tab] ?? HEADERS.matrix;

  return (
    <>
      <PageHeader
        title={t(header?.title ?? k('Security'))}
        description={header && t(header.description)}
        actions={
          <RoleButton
            requires="DEVELOPER"
            disabledReason={t('Scans start once the security API is up')}
          >
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
            </TabsList>
            <SimulatedBadge />
          </div>
          <TabsContent value="matrix" className="mt-3 flex flex-col gap-3">
            <SecurityMatrixTable rows={rows} names={names} onSelect={select} />
            <FindingsTable findings={allFindings} names={names} onSelect={select} />
          </TabsContent>
          <TabsContent value="compare" className="mt-3">
            <CompareTab orgId={organization.id} environments={items} />
          </TabsContent>
          <TabsContent value="findings" className="mt-3">
            <FindingsTable findings={allFindings} names={names} onSelect={select} />
          </TabsContent>
        </Tabs>
      )}
      <FindingSheet
        environmentName={names.get(selected?.environmentId ?? '') ?? ''}
        control={selected?.control}
        cell={
          selected
            ? rows.find((row) => row.environmentId === selected.environmentId)?.cells[
                selected.control
              ]
            : undefined
        }
        findings={allFindings.filter(
          (item) =>
            item.environmentId === selected?.environmentId && item.control === selected.control,
        )}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
