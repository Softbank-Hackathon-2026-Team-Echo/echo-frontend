import { placeLabel } from '@/lib/geo';
import { providerLabel } from '@/lib/status';
import { cn } from '@/lib/utils';

const PROVIDER_DOT: Record<string, string> = {
  aws: 'bg-aws',
  gcp: 'bg-gcp',
  onprem: 'bg-onprem',
};

/** 환경 종류 점 + 이름 (+ 위치) */
export function ProviderLabel({
  kind,
  location,
  showLocation = true,
}: {
  kind: string;
  location?: string | null;
  showLocation?: boolean;
}) {
  const place = location === undefined ? null : placeLabel({ location });
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', PROVIDER_DOT[kind] ?? 'bg-fg-muted')}
      />
      {providerLabel(kind)}
      {showLocation && location !== undefined && (
        <span className="text-fg-muted">
          · {place ?? '—'}
          {place && location && place.toLowerCase() !== location.toLowerCase() && (
            <span className="font-mono text-mono"> ({location})</span>
          )}
        </span>
      )}
    </span>
  );
}
