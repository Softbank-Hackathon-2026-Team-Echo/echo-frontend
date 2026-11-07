import type { useWatcherState } from '@/lib/api/onprem-watch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { clock, KIND_BG } from './onprem-watch-view';

/** 숫자 한 칸(요청 수 · 실패 수 · 마지막 전환 · 전환 소요) */
export function Stat({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: 'danger' | 'success';
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <span className="text-caption text-fg-muted">{label}</span>
      <span
        className={cn(
          'font-mono text-h1 tabular-nums',
          tone === 'danger' && 'text-danger-fg',
          tone === 'success' && 'text-success-fg',
        )}
      >
        {value}
      </span>
      {caption && <span className="text-small text-fg-secondary">{caption}</span>}
    </div>
  );
}

/** 색 띠 범례 */
export function Legend() {
  const items: { bg: string; label: string }[] = [
    { bg: KIND_BG.onprem, label: t('On-prem') },
    { bg: KIND_BG.aws, label: 'AWS' },
    { bg: KIND_BG.gcp, label: 'GCP' },
    { bg: 'bg-danger-solid', label: t('Failed') },
  ];
  return (
    <span className="flex flex-wrap items-center gap-3 text-small text-fg-secondary">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('size-3 rounded-sm', item.bg)} />
          {item.label}
        </span>
      ))}
    </span>
  );
}

/** 감시자(클라우드 쪽) /state 한 줄 */
export function WatcherPanel({ watcher }: { watcher: ReturnType<typeof useWatcherState> }) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-title">{t('Watcher (cloud side)')}</h2>
      {watcher.data?.watcher ? (
        <p className="text-body">
          <span className="font-mono">{watcher.data.watcher.state ?? '—'}</span>
          {' · '}
          {t('epoch {{n}}', { n: watcher.data.watcher.epoch ?? '—' })}
          {' · '}
          {watcher.data.watcher.armed ? t('armed') : t('not armed')}
          {watcher.data.watcher.promotedAt &&
            ` · ${t('last promoted {{time}}', { time: clock(Date.parse(watcher.data.watcher.promotedAt)) })}`}
        </p>
      ) : (
        <p className="text-body text-fg-secondary">
          {watcher.isPending
            ? t('Checking…')
            : t('Watcher not reachable ({{reason}}).', {
                reason: watcher.data?.result.status
                  ? `HTTP ${watcher.data.result.status}`
                  : t('no response'),
              })}
        </p>
      )}
    </section>
  );
}
