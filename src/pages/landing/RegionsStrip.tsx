import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { ProviderLabel } from '@/components/ProviderLabel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

type Tile = { kind: string; city: string; region: string };

const ROWS: Tile[][] = [
  [
    { kind: 'aws', city: 'Tokyo', region: 'ap-northeast-1' },
    { kind: 'gcp', city: 'Seoul', region: 'asia-northeast3' },
    { kind: 'onprem', city: 'Fukuoka', region: 'k3s' },
    { kind: 'aws', city: 'Singapore', region: 'ap-southeast-1' },
  ],
  [
    { kind: 'aws', city: 'Osaka', region: 'ap-northeast-3' },
    { kind: 'gcp', city: 'Tokyo', region: 'asia-northeast1' },
    { kind: 'aws', city: 'Seoul', region: 'ap-northeast-2' },
    { kind: 'gcp', city: 'Taiwan', region: 'asia-east1' },
  ],
  [
    { kind: 'onprem', city: 'Incheon', region: 'k3s' },
    { kind: 'gcp', city: 'Osaka', region: 'asia-northeast2' },
    { kind: 'aws', city: 'Singapore', region: 'ap-southeast-1' },
    { kind: 'onprem', city: 'Busan', region: 'k3s' },
  ],
];

function RegionTile({ tile }: { tile: Tile }) {
  return (
    <li className="flex shrink-0 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-xs">
      <span className="rounded-sm border border-line px-1.5 py-0.5 text-label">
        <ProviderLabel kind={tile.kind} showLocation={false} />
      </span>
      <span className="flex flex-col">
        <span className="text-title">{tile.city}</span>
        <span className="font-mono text-mono text-fg-muted">{tile.region}</span>
      </span>
    </li>
  );
}

/** L01 ⑦ 지역 타일 띠. 천천히 왼쪽으로 흐르고, 움직임 줄이기면 멈춘다 */
export function RegionsStrip() {
  const isReducedMotion = usePrefersReducedMotion();
  return (
    <section aria-labelledby="regions" className="overflow-hidden bg-brand-subtle">
      <div className="mx-auto grid max-w-content grid-cols-5 items-center gap-12 px-gutter py-20 max-compact:grid-cols-1 max-compact:px-gutter-compact">
        <div className="col-span-2 flex flex-col items-start gap-4 max-compact:col-span-1">
          <h2 id="regions" className="scroll-mt-20 text-h1 compact:text-headline">
            Not locked to one cloud or one region
          </h2>
          <p className="text-lead-sm text-fg-secondary">
            An environment is a cloud region or an on-prem city. Register as many as you like;
            EchoPort only evacuates to the ones outside the impact radius.
          </p>
          <Button asChild variant="secondary">
            <Link to="/login">
              Add an environment
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="col-span-3 flex flex-col gap-3 overflow-hidden max-compact:col-span-1">
          {ROWS.map((row, rowIndex) => (
            <div
              key={row.map((tile) => tile.city + tile.kind).join()}
              className={cn(rowIndex === 1 && 'pl-8')}
            >
              {/* 같은 목록을 두 번 이어 붙여 끊김 없이 흐르게 한다. 두 번째 목록은 읽지 않는다 */}
              <div className={cn('flex w-max', !isReducedMotion && 'animate-marquee')}>
                <ul className="flex gap-3 pr-3">
                  {row.map((tile) => (
                    <RegionTile key={tile.kind + tile.city} tile={tile} />
                  ))}
                </ul>
                <ul aria-hidden className="flex gap-3 pr-3">
                  {row.map((tile) => (
                    <RegionTile key={tile.kind + tile.city} tile={tile} />
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
