import { TriangleAlert } from 'lucide-react';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import type { EnvironmentSummary } from '@/lib/api/types';
import { regionGroupLabel } from '@/lib/geo';
import { connectionStatusView, envRoleView, shortSha } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { ServiceOnEnvironment } from './types';

type TopologyProps = {
  environments: EnvironmentSummary[];
  byEnvironment: Map<string, ServiceOnEnvironment[]>;
  atRisk: Set<string>;
  edgeUrl: string | undefined;
};

/** 환경 노드 하나: 역할 · 버전 · 트래픽 막대 · 위험 */
function EnvironmentNode({
  environment,
  links,
  atRisk,
}: {
  environment: EnvironmentSummary;
  links: ServiceOnEnvironment[];
  atRisk: boolean;
}) {
  const primary = links.find((item) => item.link.role === 'SERVING') ?? links[0];
  const weight = links.reduce((sum, item) => sum + item.link.trafficWeight, 0);
  const role = primary?.link.role;
  const roleText =
    role === 'SERVING'
      ? `Primary · ${shortSha(primary?.link.currentDeployment?.commitSha)}`
      : role === 'STANDBY'
        ? `Standby · ${primary?.link.versionStatus === 'IN_SYNC' ? 'Warm' : 'Behind'}`
        : 'No services';
  return (
    <div
      className={cn(
        'flex w-56 flex-col gap-2 rounded-md border bg-surface p-3 shadow-xs',
        atRisk ? 'border-danger-solid' : 'border-line',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-body-medium">{environment.name}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <ProviderLabel kind={environment.kind} showLocation={false} />
        {atRisk ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-danger-bg px-1.5 text-label text-danger-fg">
            <TriangleAlert aria-hidden className="size-3" />
            At risk
          </span>
        ) : role ? (
          <StatusBadge {...envRoleView(role)} />
        ) : (
          <StatusBadge {...connectionStatusView(environment.connectionStatus)} />
        )}
      </span>
      <span className="flex items-center justify-between gap-2 text-caption text-fg-muted">
        <span>{roleText}</span>
        <span className="font-mono">{environment.location ?? '—'}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-subtle">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${weight}%` }} />
        </span>
        <span className="w-9 text-right font-mono text-mono tabular-nums">{weight}%</span>
      </span>
    </div>
  );
}

/**
 * S01 토폴로지 (1차): 지역별로 묶은 환경 노드와 앞단 프록시.
 * 연결선·확대는 React Flow 로 옮길 때 그린다(노션 IA 결정 9).
 */
export function Topology({ environments, byEnvironment, atRisk, edgeUrl }: TopologyProps) {
  const groups = new Map<string, EnvironmentSummary[]>();
  for (const environment of environments) {
    const label = `${regionGroupLabel(environment)}${environment.kind === 'onprem' ? ' (on-prem)' : ''}`;
    groups.set(label, [...(groups.get(label) ?? []), environment]);
  }
  return (
    <div className="flex flex-1 flex-wrap items-start gap-4 rounded-md bg-canvas p-4">
      <div className="flex flex-col gap-1 self-center">
        <span className="w-fit rounded-sm bg-brand-subtle px-1.5 font-mono text-mono text-brand-on-subtle">
          traffic
        </span>
        <div className="flex w-48 flex-col gap-0.5 rounded-md border border-line-strong bg-subtle p-3">
          <span className="text-body-medium">Edge proxy</span>
          <span className="truncate font-mono text-mono text-fg-muted">
            {edgeUrl?.replace(/^https:\/\//, '') ?? 'No public URL yet'}
          </span>
        </div>
      </div>
      {[...groups.entries()].map(([label, members]) => {
        const risky = members.some((environment) => atRisk.has(environment.id));
        return (
          <div
            key={label}
            className={cn(
              'flex flex-col gap-2 rounded-lg border border-dashed p-3',
              risky ? 'border-warning-solid bg-warning-bg' : 'border-line-strong bg-subtle',
            )}
          >
            <span className="text-overline uppercase text-fg-muted">{label}</span>
            {members.map((environment) => (
              <EnvironmentNode
                key={environment.id}
                environment={environment}
                links={byEnvironment.get(environment.id) ?? []}
                atRisk={atRisk.has(environment.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
