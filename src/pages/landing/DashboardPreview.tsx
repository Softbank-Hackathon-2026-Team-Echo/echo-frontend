import { ArrowRight, Bell, ChevronDown, Zap } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { ProviderLabel } from '@/components/ProviderLabel';
import { StatusBadge } from '@/components/StatusBadge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AuditRows } from './AuditRows';
import { PreviewKpis } from './PreviewKpis';
import { PreviewSidebar } from './PreviewSidebar';
import { RequestsIllustration } from './RequestsIllustration';
import { TopologyIllustration } from './TopologyIllustration';

const EVENTS = [
  { at: '12:03:11', text: 'disaster.started · M7.2 Tokyo', tone: 'text-danger-fg' },
  { at: '12:03:11', text: 'aws-tokyo-prod → at risk', tone: 'text-warning-fg' },
  { at: '12:03:12', text: '2 safe targets found', tone: 'text-fg' },
  { at: '12:02:40', text: 'replication lag 120 ms', tone: 'text-fg' },
];

const DISASTER = [
  ['Epicenter', '35.2°N 139.4°E · M7.2'],
  ['Impact radius', '300 km'],
  ['Affected', 'aws-tokyo-prod'],
  ['Safe targets', 'gcp-seoul · onprem-fukuoka'],
];

const ENVIRONMENTS = [
  { kind: 'aws', name: 'aws-tokyo-prod', badge: <StatusBadge label="At risk" tone="warning" /> },
  { kind: 'gcp', name: 'gcp-seoul-standby', badge: <StatusBadge label="Standby" tone="neutral" /> },
  { kind: 'onprem', name: 'onprem-fukuoka', badge: <StatusBadge label="Standby" tone="neutral" /> },
];

type DashboardPreviewProps = {
  /** alert: 재난 직후(이전 전) · evacuating: 서울로 이전 중 */
  variant: 'alert' | 'evacuating';
};

/** S01 대시보드 그림. 실제 컴포넌트(StatusBadge·ProviderLabel·Panel)에 예시 값을 넣었다 */
export function DashboardPreview({ variant }: DashboardPreviewProps) {
  const isEvacuating = variant === 'evacuating';
  return (
    <div className="flex bg-canvas text-left">
      <PreviewSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-topbar items-center justify-between gap-2 border-b border-line bg-surface px-4">
          <span className="text-small text-fg-secondary">Dashboard</span>
          <span className="flex items-center gap-2">
            <span className="flex h-7 items-center gap-6 rounded-md border border-line-strong px-2 text-small max-sm:hidden">
              Org · echoport
              <ChevronDown className="size-3.5 text-fg-muted" />
            </span>
            <span className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Zap />
              Simulate disaster
            </span>
            <Bell className="size-4 text-fg-secondary" />
          </span>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-h3">Dashboard</span>
              {isEvacuating ? (
                <StatusBadge label="Evacuating to gcp-seoul · 70%" tone="migrating" />
              ) : (
                <StatusBadge
                  label="M7.2 near Tokyo · aws-tokyo-prod at risk · 12:03"
                  tone="danger"
                />
              )}
            </span>
            <span className="flex items-center gap-2 text-caption text-fg-secondary">
              {isEvacuating ? 'Elapsed 2m 41s' : 'Last 15 min'}
              <span
                className={cn(
                  buttonVariants({ size: 'xs' }),
                  !isEvacuating && 'bg-danger-solid text-fg-on-brand',
                )}
              >
                {isEvacuating ? 'Open migration #42' : 'View evacuation options'}
                <ArrowRight />
              </span>
            </span>
          </div>

          <PreviewKpis variant={variant} />

          <div className="grid grid-cols-3 gap-3 max-compact:grid-cols-1">
            <Panel
              title="Topology"
              action={<span className="text-caption text-brand">Open full screen</span>}
              className="col-span-2 p-3 max-compact:col-span-1 max-sm:hidden"
            >
              <TopologyIllustration />
            </Panel>
            <div className="flex flex-col gap-3">
              <section className="flex flex-col gap-2 rounded-lg border border-danger-solid bg-surface p-3">
                <span className="text-overline text-danger-fg uppercase">Active disaster</span>
                <dl className="flex flex-col gap-1.5">
                  {DISASTER.map(([term, value]) => (
                    <div key={term} className="flex justify-between gap-2 text-caption">
                      <dt className="text-fg-secondary">{term}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <Panel title="Live events" className="gap-2 p-3">
                <ul className="flex flex-col gap-1.5">
                  {EVENTS.map((event) => (
                    <li key={event.text} className="flex gap-2 font-mono text-mono">
                      <span className="text-fg-muted">{event.at}</span>
                      <span className={event.tone}>{event.text}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 max-compact:grid-cols-1">
            <Panel title="Requests · A vs B" className="gap-2 p-3">
              <RequestsIllustration />
            </Panel>
            <Panel title="Environments" className="gap-2 p-3">
              <ul className="flex flex-col gap-2">
                {ENVIRONMENTS.map((env) => (
                  <li
                    key={env.name}
                    className="flex items-center justify-between gap-2 text-caption"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ProviderLabel kind={env.kind} showLocation={false} />
                      <span className="truncate font-mono text-mono">{env.name}</span>
                    </span>
                    {env.badge}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Recent activity" className="gap-0 p-3">
              <AuditRows />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
