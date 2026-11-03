import { Activity, Cloud, Cpu, Database, Server } from 'lucide-react';

// 고객 로고가 아니라 지원하는 기반 기술이다
const ITEMS = [
  { label: 'AWS', icon: Cloud },
  { label: 'Google Cloud', icon: Cloud },
  { label: 'On-prem K3s', icon: Server },
  { label: 'Kubernetes', icon: Cpu },
  { label: 'PostgreSQL', icon: Database },
  { label: 'OpenTelemetry', icon: Activity },
];

/** L01 ① 지원 띠 */
export function SupportStrip() {
  return (
    <section aria-labelledby="runs-across" className="border-b border-line">
      <div className="mx-auto flex max-w-content flex-col items-center gap-5 px-gutter py-10 max-compact:px-gutter-compact">
        <h2 id="runs-across" className="font-mono text-mono text-fg-muted uppercase">
          Runs across clouds, regions and your own servers
        </h2>
        <ul className="flex w-full flex-wrap items-center justify-around gap-x-10 gap-y-4">
          {ITEMS.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-2 text-h3 text-fg-muted">
              <Icon aria-hidden className="size-5" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
