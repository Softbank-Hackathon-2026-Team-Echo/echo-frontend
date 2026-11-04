import { currentLocale } from './i18n';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** "3 minutes ago" 같은 상대 시각. 값이 없으면 — */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size || unit === 'second') {
      return new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' }).format(
        Math.round(seconds / size),
        unit,
      );
    }
  }
  return '—';
}

/** 두 시각 사이 걸린 시간 ("1m 05s"). 끝이 없으면 지금까지 */
export function elapsed(
  fromIso: string | null | undefined,
  toIso?: string | null,
  now = Date.now(),
) {
  if (!fromIso) return '—';
  const end = toIso ? new Date(toIso).getTime() : now;
  const total = Math.max(0, Math.round((end - new Date(fromIso).getTime()) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(currentLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
