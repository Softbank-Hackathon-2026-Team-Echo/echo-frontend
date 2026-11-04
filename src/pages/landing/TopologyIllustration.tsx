import type { CSSProperties, ReactNode } from 'react';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// 그림 안의 자리(%)는 아래 선(viewBox 100×100)과 같은 좌표계다
function at(left: number, top: number, width: number, height?: number): CSSProperties {
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: height === undefined ? undefined : `${height}%`,
  };
}

function Region({
  title,
  style,
  isAtRisk = false,
  children,
}: {
  title: string;
  style: CSSProperties;
  isAtRisk?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={style}
      className={cn(
        'absolute flex flex-col gap-1.5 rounded-md border border-dashed p-2',
        isAtRisk ? 'border-warning-solid bg-warning-bg' : 'border-line-strong bg-subtle',
      )}
    >
      <span className="text-overline text-fg-muted uppercase">{title}</span>
      {children}
    </div>
  );
}

function Node({
  kind,
  name,
  badge,
  traffic,
  isServing = false,
}: {
  kind: string;
  name: string;
  badge: ReactNode;
  traffic: number;
  isServing?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border bg-surface p-2 shadow-xs',
        isServing ? 'border-chart-3' : 'border-line',
      )}
    >
      <span className="flex items-center gap-1.5 text-caption">
        <span className="shrink-0 whitespace-nowrap">
          <ProviderLabel kind={kind} showLocation={false} />
        </span>
        <span className="truncate font-mono text-mono">{name}</span>
      </span>
      {badge}
      <span className="flex items-center gap-1.5">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-subtle">
          <span className="block h-full rounded-full bg-chart-1" style={{ width: `${traffic}%` }} />
        </span>
        <span className="font-mono text-mono tabular-nums">{traffic}%</span>
      </span>
    </div>
  );
}

/** 대시보드 토폴로지 그림. 실제 화면은 React Flow 지만 소개 화면에서는 같은 모양을 가볍게 그린다 */
export function TopologyIllustration() {
  return (
    <div className="relative h-72 rounded-md bg-canvas">
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        fill="none"
      >
        {/* 트래픽: 굵기 = 비율 */}
        <path
          d="M25,48 C29,48 28,22 33,22"
          vectorEffect="non-scaling-stroke"
          className="stroke-chart-3"
          strokeWidth={6}
        />
        <path
          d="M25,54 C29,54 28,76 33,76"
          vectorEffect="non-scaling-stroke"
          className="stroke-chart-1"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        {/* 복제 */}
        <path
          d="M60,26 C66,26 64,50 71,50"
          vectorEffect="non-scaling-stroke"
          className="stroke-fg-muted"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <path
          d="M47,46 L47,55"
          vectorEffect="non-scaling-stroke"
          className="stroke-fg-muted"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </svg>

      <div
        style={at(3, 40, 22)}
        className="absolute flex flex-col gap-0.5 rounded-md border border-line bg-surface p-2"
      >
        <span className="text-body-medium">{t('Edge proxy')}</span>
        <span className="truncate font-mono text-mono text-fg-muted">edge.echoport.uk</span>
      </div>

      <Region title="Japan · Tokyo" style={at(32, 3, 29, 43)} isAtRisk>
        <Node
          kind="aws"
          name="aws-tokyo-prod"
          badge={<StatusBadge label={t('At risk')} tone="warning" className="w-fit" />}
          traffic={100}
          isServing
        />
      </Region>
      <Region title="Korea · Seoul" style={at(32, 52, 29, 40)}>
        <Node
          kind="gcp"
          name="gcp-seoul-standby"
          badge={<StatusBadge label={t('Standby')} tone="neutral" className="w-fit" />}
          traffic={0}
        />
      </Region>
      <Region title="Japan · Fukuoka" style={at(71, 28, 27, 43)}>
        <Node
          kind="onprem"
          name="onprem-fukuoka"
          badge={<StatusBadge label={t('Standby')} tone="neutral" className="w-fit" />}
          traffic={0}
        />
      </Region>

      <span className="absolute bottom-2 left-2 flex gap-3 rounded-sm border border-line bg-surface px-2 py-0.5 text-caption text-fg-muted">
        <span>{t('traffic (width = weight)')}</span>
        <span>{t('replication')}</span>
      </span>
    </div>
  );
}
