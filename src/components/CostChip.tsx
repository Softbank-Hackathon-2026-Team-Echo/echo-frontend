import { CircleDollarSign } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usd, useCloudCosts } from '@/lib/api/costs';
import { t } from '@/lib/i18n';
import { CostBreakdownDialog, monthlyEstimate } from './CostBreakdownDialog';

/** 상단 바의 월 추정 비용. 누르면 단가표 */
export function CostChip({ orgId }: { orgId: string }) {
  const costs = useCloudCosts(orgId);
  const [open, setOpen] = useState(false);
  if (!costs.data) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="tabular-nums text-fg-secondary"
        onClick={() => setOpen(true)}
        aria-label={t('Estimated cloud cost per month')}
      >
        <CircleDollarSign aria-hidden />
        <span className="max-compact:sr-only">
          {t('~{{amount}}/mo est.', { amount: usd(monthlyEstimate(costs.data.totalHourlyUsd), 0) })}
        </span>
      </Button>
      <CostBreakdownDialog open={open} onOpenChange={setOpen} orgId={orgId} />
    </>
  );
}
