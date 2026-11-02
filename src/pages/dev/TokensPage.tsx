import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

// Tailwind 가 클래스를 찾을 수 있게 전체 클래스 이름을 문자열로 둔다
const COLOR_GROUPS: { title: string; swatches: [name: string, className: string][] }[] = [
  {
    title: 'Background',
    swatches: [
      ['canvas', 'bg-canvas'],
      ['surface', 'bg-surface'],
      ['raised', 'bg-raised'],
      ['subtle', 'bg-subtle'],
      ['inverse', 'bg-inverse'],
      ['overlay', 'bg-overlay'],
    ],
  },
  {
    title: 'Text',
    swatches: [
      ['fg', 'bg-fg'],
      ['fg-secondary', 'bg-fg-secondary'],
      ['fg-muted', 'bg-fg-muted'],
      ['fg-inverse', 'bg-fg-inverse'],
      ['fg-on-brand', 'bg-fg-on-brand'],
    ],
  },
  {
    title: 'Brand · line',
    swatches: [
      ['brand', 'bg-brand'],
      ['brand-hover', 'bg-brand-hover'],
      ['brand-subtle', 'bg-brand-subtle'],
      ['brand-on-subtle', 'bg-brand-on-subtle'],
      ['focus', 'bg-focus'],
      ['line', 'bg-line'],
      ['line-strong', 'bg-line-strong'],
    ],
  },
  {
    title: 'Status (solid)',
    swatches: [
      ['success', 'bg-success-solid'],
      ['warning', 'bg-warning-solid'],
      ['danger', 'bg-danger-solid'],
      ['migrating', 'bg-migrating-solid'],
      ['ai', 'bg-ai-solid'],
    ],
  },
  {
    title: 'Provider · chart',
    swatches: [
      ['aws', 'bg-aws'],
      ['gcp', 'bg-gcp'],
      ['onprem', 'bg-onprem'],
      ['chart-1', 'bg-chart-1'],
      ['chart-2', 'bg-chart-2'],
      ['chart-3', 'bg-chart-3'],
      ['chart-4', 'bg-chart-4'],
      ['chart-5', 'bg-chart-5'],
      ['chart-6', 'bg-chart-6'],
    ],
  },
];

const STATUS_BADGES: [string, string][] = [
  ['Connected', 'bg-success-bg text-success-fg'],
  ['Out of sync', 'bg-warning-bg text-warning-fg'],
  ['Failed', 'bg-danger-bg text-danger-fg'],
  ['Deploying', 'bg-migrating-bg text-migrating-fg'],
  ['AI pre-check', 'bg-ai-bg text-ai-fg'],
  ['simulated', 'bg-subtle text-fg-muted'],
];

const TYPE_STYLES: [string, string][] = [
  ['h1', 'text-h1'],
  ['h2', 'text-h2'],
  ['h3', 'text-h3'],
  ['title', 'text-title'],
  ['body', 'text-body'],
  ['body-medium', 'text-body-medium'],
  ['small', 'text-small'],
  ['caption', 'text-caption'],
  ['label', 'text-label'],
  ['overline', 'text-overline uppercase'],
  ['metric-xl', 'text-metric-xl tabular-nums'],
  ['metric', 'text-metric tabular-nums'],
  ['mono', 'text-mono font-mono'],
];

const SPACES: [string, string][] = [
  ['2', 'w-0.5'],
  ['4', 'w-1'],
  ['6', 'w-1.5'],
  ['8', 'w-2'],
  ['10', 'w-2.5'],
  ['12', 'w-3'],
  ['16', 'w-4'],
  ['20', 'w-5'],
  ['24', 'w-6'],
  ['32', 'w-8'],
  ['40', 'w-10'],
  ['48', 'w-12'],
  ['64', 'w-16'],
  ['80', 'w-20'],
];

const RADII = ['rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl'];
const SHADOWS = ['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-overline uppercase text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function TokensPage() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <main className="mx-auto flex max-w-content flex-col gap-8 p-gutter">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-h1">Design tokens</h1>
          <p className="text-small text-fg-muted">src/styles/tokens.css · development only</p>
        </div>
        <div className="flex gap-2">
          {themes.map((name) => (
            <Button
              key={name}
              size="sm"
              variant={name === theme ? 'default' : 'outline'}
              onClick={() => setTheme(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      </header>

      {COLOR_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
            {group.swatches.map(([name, className]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className={cn('h-12 rounded-md border border-line', className)} />
                <span className="font-mono text-mono text-fg-secondary">{name}</span>
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Status badges">
        <div className="flex flex-wrap gap-2">
          {STATUS_BADGES.map(([label, className]) => (
            <span key={label} className={cn('rounded-sm px-2 py-0.5 text-label', className)}>
              {label}
            </span>
          ))}
          <Badge>shadcn badge</Badge>
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          {TYPE_STYLES.map(([name, className]) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="w-24 shrink-0 font-mono text-mono text-fg-muted">{name}</span>
              <span className={className}>Move services without downtime 1,234</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Space (px)">
        <div className="flex flex-col gap-1">
          {SPACES.map(([px, className]) => (
            <div key={px} className="flex items-center gap-3">
              <span className="w-8 font-mono text-mono text-fg-muted">{px}</span>
              <div className={cn('h-3 rounded-xs bg-brand', className)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radius · shadow">
        <div className="flex flex-wrap gap-4">
          {RADII.map((className) => (
            <div
              key={className}
              className={cn('flex size-20 items-end bg-brand-subtle p-1', className)}
            >
              <span className="font-mono text-mono text-brand-on-subtle">{className}</span>
            </div>
          ))}
          {SHADOWS.map((className) => (
            <div
              key={className}
              className={cn('flex size-20 items-end rounded-md bg-raised p-1', className)}
            >
              <span className="font-mono text-mono text-fg-muted">{className}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Controls (32px)">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Deploy</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button disabled>Disabled</Button>
          <Input className="w-56" placeholder="Search environments" />
        </div>
      </Section>
    </main>
  );
}
