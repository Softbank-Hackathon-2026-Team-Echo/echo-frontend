import { Panel } from '@/components/Panel';
import { Skeleton } from '@/components/ui/skeleton';
import { usd, useCloudCosts } from '@/lib/api/costs';
import { t } from '@/lib/i18n';

/** 대시보드 클라우드 비용. 시간당 값은 목록가 추정이고 청구 값은 어제까지다. 둘을 섞지 않는다 */
export function CloudCostPanel({ orgId, className }: { orgId: string; className?: string }) {
  const costs = useCloudCosts(orgId);
  const data = costs.data;
  const unverified = [...(data?.environments ?? []), ...(data?.shared ?? [])].some((item) =>
    item.components.some((component) => !component.priceVerified),
  );

  return (
    <Panel title={t('Cloud cost')} className={className}>
      {costs.isPending ? (
        <Skeleton className="h-32" />
      ) : !data ? (
        <p className="text-small text-fg-muted">{t('Cost data is not available right now.')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-metric-xl tabular-nums">{usd(data.totalHourlyUsd, 4)}/h</span>
            <span className="text-small text-fg-secondary tabular-nums">
              {t('{{amount}}/day', { amount: usd(data.totalDailyUsd) })}
            </span>
            <span className="text-caption text-fg-muted">{t('Live estimate')}</span>
          </div>
          <ul className="flex flex-col gap-1 text-small">
            {data.environments.map((item) => (
              <li key={item.environmentId} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-mono">{item.environmentName}</span>
                <span className="tabular-nums">
                  {item.hourlyUsd === null ? '—' : `${usd(item.hourlyUsd, 4)}/h`}
                </span>
              </li>
            ))}
            {data.shared.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-2">
                <span className="truncate text-fg-secondary">{item.name}</span>
                <span className="tabular-nums">{usd(item.hourlyUsd, 4)}/h</span>
              </li>
            ))}
            {data.excluded.map((item) => (
              <li key={item.environmentId} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-mono">{item.environmentName}</span>
                <span className="text-fg-muted">{item.note}</span>
              </li>
            ))}
          </ul>
          {data.billing.map((bill) => {
            const last = bill.days.at(-1);
            return (
              <p key={bill.provider} className="text-caption text-fg-muted">
                {bill.available && last
                  ? t('{{label}} · billed on {{date}}: {{amount}}', {
                      label: bill.label,
                      date: last.date,
                      amount: usd(last.usageUsd),
                    })
                  : (bill.note ?? bill.label)}
              </p>
            );
          })}
          {unverified && (
            <p className="text-caption text-fg-muted">{t('Some prices unverified')}</p>
          )}
        </>
      )}
    </Panel>
  );
}
