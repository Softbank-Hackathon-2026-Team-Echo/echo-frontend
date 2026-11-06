import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usd, useCloudCosts } from '@/lib/api/costs';
import { t } from '@/lib/i18n';

const HOURS_PER_MONTH = 730;

/** 월 추정 = 시간당 목록가 × 730시간. 청구 실측이 아니다 */
export function monthlyEstimate(hourlyUsd: number): number {
  return hourlyUsd * HOURS_PER_MONTH;
}

/**
 * 비용 단가표(Railway 사용량 화면). 환경 · 공용 항목마다 자원 하나씩 수량 × 단가 = 시간당.
 * 검증하지 않은 단가는 표시하고 숨기지 않는다
 */
export function CostBreakdownDialog({
  open,
  onOpenChange,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}) {
  const costs = useCloudCosts(orgId);
  const data = costs.data;
  // 닫혀 있을 때는 표 줄을 만들지 않는다(JSX 자식은 닫힌 다이얼로그에서도 계산된다)
  const groups = !open
    ? []
    : [
        ...(data?.environments ?? []).map((item) => ({
          key: item.environmentId,
          name: item.environmentName,
          components: item.components,
        })),
        ...(data?.shared ?? []).map((item) => ({
          key: item.key,
          name: item.name,
          components: item.components,
        })),
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('Cloud cost breakdown')}</DialogTitle>
          <DialogDescription>
            {data
              ? t(
                  'Estimated {{month}}/month ({{hour}}/h × 730 h) from public list prices. Not a bill.',
                  {
                    month: usd(monthlyEstimate(data.totalHourlyUsd), 0),
                    hour: usd(data.totalHourlyUsd, 4),
                  },
                )
              : t('Loading prices…')}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Resource')}</TableHead>
                <TableHead className="text-right">{t('Quantity')}</TableHead>
                <TableHead className="text-right">{t('Unit price')}</TableHead>
                <TableHead className="text-right">{t('Per hour')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => [
                <TableRow key={group.key} className="bg-subtle hover:bg-subtle">
                  <TableCell colSpan={4} className="font-mono text-mono">
                    {group.name}
                  </TableCell>
                </TableRow>,
                ...group.components.map((component) => (
                  <TableRow key={`${group.key}-${component.name}`}>
                    <TableCell>
                      <span className="flex flex-col gap-0.5">
                        {component.name}
                        {!component.priceVerified && (
                          <span className="text-caption text-warning-fg">
                            {t('Price not verified')}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {component.quantity} {component.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usd(component.unitPriceUsd, 4)}/{component.priceUnit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usd(component.hourlyUsd, 4)}
                    </TableCell>
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
