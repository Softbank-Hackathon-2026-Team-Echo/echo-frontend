import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/StatusBadge';

function Box({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-md bg-subtle p-2.5">{children}</div>;
}

function Detect() {
  return (
    <Box>
      <StatusBadge label="M7.2 near Tokyo" tone="danger" className="w-fit" />
      {(
        [
          ['aws-tokyo-prod', 'At risk', 'warning'],
          ['gcp-seoul-standby', 'Healthy', 'success'],
          ['onprem-fukuoka', 'Standby', 'neutral'],
        ] as const
      ).map(([name, label, tone]) => (
        <span key={name} className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-mono">{name}</span>
          <StatusBadge label={label} tone={tone} />
        </span>
      ))}
    </Box>
  );
}

function Choose() {
  return (
    <Box>
      {(
        [
          ['gcp-seoul-standby', 82, 'bg-success-solid'],
          ['onprem-fukuoka', 74, 'bg-migrating-solid'],
        ] as const
      ).map(([name, score, bar]) => (
        <span key={name} className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-mono">{name}</span>
            <span className="text-metric tabular-nums">{score}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-line">
            <span className={`block h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
          </span>
        </span>
      ))}
    </Box>
  );
}

function Test() {
  return (
    <Box>
      <span className="rounded-sm bg-danger-bg px-2 py-1 font-mono text-mono text-danger-fg">
        − max_connections = 100
      </span>
      <span className="rounded-sm bg-success-bg px-2 py-1 font-mono text-mono text-success-fg">
        + max_connections = 200
      </span>
      <span className="flex items-center gap-1.5 text-small text-success-fg">
        <CircleCheck aria-hidden className="size-4" />
        Sandbox passed 12/12
      </span>
    </Box>
  );
}

function Move() {
  return (
    <Box>
      <span className="flex justify-between font-mono text-mono text-fg-secondary">
        <span>Tokyo 30%</span>
        <span>Seoul 70%</span>
      </span>
      <span className="flex h-1.5 gap-0.5">
        <span className="w-3/10 rounded-full bg-chart-3" />
        <span className="w-7/10 rounded-full bg-chart-1" />
      </span>
      <span className="flex items-center gap-1.5 text-small text-success-fg">
        <CircleCheck aria-hidden className="size-4" />
        Writer cutover · LSN matched
      </span>
    </Box>
  );
}

/** ③ 단계 카드 안의 미니 UI. 단계 키 → 그림 */
export function StepMini({ step }: { step: 'detect' | 'choose' | 'test' | 'move' }) {
  switch (step) {
    case 'detect':
      return <Detect />;
    case 'choose':
      return <Choose />;
    case 'test':
      return <Test />;
    case 'move':
      return <Move />;
  }
}
