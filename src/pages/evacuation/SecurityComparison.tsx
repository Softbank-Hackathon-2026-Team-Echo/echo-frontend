import { SecurityCompareTable } from '@/components/SecurityCompareTable';
import { SimulatedBadge } from '@/components/SimulatedBadge';
import type { SecurityCompareRow } from '@/lib/api/security';

/** 이전 전후 보안 비교 (E01-3 오른쪽 패널) */
export function SecurityComparison({
  rows,
  sourceName,
  targetName,
}: {
  rows: SecurityCompareRow[];
  sourceName: string;
  targetName: string;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-title">Security before / after</h2>
        <SimulatedBadge />
      </header>
      <SecurityCompareTable rows={rows} sourceName={sourceName} targetName={targetName} />
    </section>
  );
}
