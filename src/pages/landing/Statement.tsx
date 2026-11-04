import { Globe, ShieldCheck, TriangleAlert } from 'lucide-react';
import { k, t } from '@/lib/i18n';

const PILLARS = [
  {
    fig: 'FIG 0.1',
    icon: TriangleAlert,
    title: k('Disaster-aware'),
    body: k(
      'Earthquake and typhoon alerts are turned into an impact radius. Environments inside it are marked at risk.',
    ),
  },
  {
    fig: 'FIG 0.2',
    icon: Globe,
    title: k('Any cloud, any region'),
    body: k(
      'AWS, GCP and on-prem sites are all just environments. Evacuate to whichever one is safe, not a fixed backup.',
    ),
  },
  {
    fig: 'FIG 0.3',
    icon: ShieldCheck,
    title: k('Human-approved AI'),
    body: k(
      'An AI agent tests the move in a sandbox and proposes fixes. Nothing touches production until a person approves.',
    ),
  },
];

/** L01 ② 두 톤 문장 + 기둥 3개 */
export function Statement() {
  return (
    <section
      aria-labelledby="statement"
      className="mx-auto flex max-w-content flex-col gap-20 px-gutter py-20 max-compact:gap-12 max-compact:px-gutter-compact"
    >
      <h2 id="statement" className="text-h1 text-fg-muted compact:text-headline">
        <span className="text-fg">{t('Disasters don’t wait for a maintenance window.')}</span>{' '}
        {t(
          'EchoPort watches disaster alerts, picks a safe region, tests the move with an AI agent and shifts live traffic and data before the outage reaches your users.',
        )}
      </h2>
      <ul className="grid grid-cols-3 max-compact:grid-cols-1 max-compact:gap-10">
        {PILLARS.map(({ fig, icon: Icon, title, body }, index) => (
          <li
            key={title}
            className={
              index === 0
                ? 'flex flex-col gap-4 pr-8 max-compact:pr-0'
                : 'flex flex-col gap-4 border-l border-line px-8 max-compact:border-l-0 max-compact:px-0'
            }
          >
            <span className="font-mono text-mono text-fg-muted">{fig}</span>
            <span className="flex w-30 justify-center">
              <Icon aria-hidden strokeWidth={0.75} className="size-22 text-line-strong" />
            </span>
            <h3 className="text-h3">{t(title)}</h3>
            <p className="text-lead-sm text-fg-secondary">{t(body)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
