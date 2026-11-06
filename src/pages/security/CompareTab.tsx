import { useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { SecurityCompareTable } from '@/components/SecurityCompareTable';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSecurityCompare } from '@/lib/api/security';
import type { EnvironmentSummary } from '@/lib/api/types';
import { dateTime } from '@/lib/format';
import { t } from '@/lib/i18n';

type CompareTabProps = { orgId: string; environments: EnvironmentSummary[] };

function EnvironmentSelect({
  label,
  value,
  onChange,
  environments,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  environments: EnvironmentSummary[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {environments.map((environment) => (
          <SelectItem key={environment.id} value={environment.id}>
            {environment.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 두 환경을 골라 나란히 본다. E01-3 패널과 같은 표다 */
export function CompareTab({ orgId, environments }: CompareTabProps) {
  const [picked, setPicked] = useState<{ source?: string; target?: string }>({});
  const source = picked.source ?? environments[0]?.id;
  const target = picked.target ?? environments[1]?.id ?? environments[0]?.id;
  const compare = useSecurityCompare(orgId, source, target);
  const data = compare.data;
  const nameOf = (id: string | undefined) =>
    environments.find((item) => item.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <EnvironmentSelect
          label={t('Source environment')}
          value={source}
          onChange={(value) => setPicked({ ...picked, source: value })}
          environments={environments}
        />
        <span className="text-body-medium text-fg-muted">{t('vs')}</span>
        <EnvironmentSelect
          label={t('Target environment')}
          value={target}
          onChange={(value) => setPicked({ ...picked, target: value })}
          environments={environments}
        />
      </div>
      {source === target ? (
        <p className="text-small text-fg-secondary">{t('Choose two different environments.')}</p>
      ) : compare.isError ? (
        <ErrorState error={compare.error} onRetry={() => compare.refetch()} />
      ) : !data ? (
        <Skeleton className="h-56 rounded-2xl" />
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-small text-fg-secondary">
            {t('{{blocking}} blocking · {{worse}} worse on target · checked {{time}}', {
              blocking: data.summary.blocking,
              worse: data.summary.worseOnTarget,
              time: dateTime(data.checkedAt),
            })}
            {data.simulated && <SimulatedBadge />}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-4">
            <SecurityCompareTable
              rows={data.rows}
              sourceName={nameOf(source)}
              targetName={nameOf(target)}
              showResult
            />
          </div>
        </>
      )}
    </div>
  );
}
