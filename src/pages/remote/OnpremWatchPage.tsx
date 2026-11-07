import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnpremWatch, useWatcherState } from '@/lib/api/onprem-watch';
import { t } from '@/lib/i18n';
import {
  DEFAULT_GUEST_HOST,
  DEFAULT_WATCHER_HOST,
  hostOf,
  WATCH_STRIP_SIZE,
  type WatchKind,
  watchKind,
} from '@/lib/onprem-watch';
import { cn } from '@/lib/utils';

const KIND_BG: Record<WatchKind, string> = {
  onprem: 'bg-onprem',
  aws: 'bg-aws',
  gcp: 'bg-gcp',
  other: 'bg-fg-muted',
};

function kindLabel(kind: WatchKind) {
  if (kind === 'onprem') return t('On-prem');
  if (kind === 'aws') return 'AWS';
  if (kind === 'gcp') return 'GCP';
  return t('Other');
}

const clock = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * 노트북 온프레 시연(④)의 발표 화면. 손님 주소를 2초마다 불러 응답 환경 · 최근 60건 · 실패 수 · 마지막 전환을 보인다.
 * 주소는 `?guest=` · `?watcher=` 로 바꿀 수 있고, 값은 이 브라우저의 기록일 뿐 EchoPort 서버에 저장하지 않는다.
 */
export default function OnpremWatchPage() {
  const [params, setParams] = useSearchParams();
  const guest = hostOf(params.get('guest') ?? DEFAULT_GUEST_HOST);
  const watcherHost = hostOf(params.get('watcher') ?? DEFAULT_WATCHER_HOST);
  const [guestDraft, setGuestDraft] = useState(guest);
  const [watcherDraft, setWatcherDraft] = useState(watcherHost);
  const watch = useOnpremWatch(guest);
  const watcher = useWatcherState(watcherHost);

  const last = watch.samples.at(-1);
  const failingNow = last !== undefined && last.environment === null;
  const kind = watch.current ? watchKind(watch.current) : null;

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    next.set('guest', hostOf(guestDraft));
    next.set('watcher', hostOf(watcherDraft));
    setParams(next, { replace: true });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 bg-canvas p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1">{t('On-prem watch')}</h1>
        <p className="text-body text-fg-secondary">
          {t(
            'This browser calls the guest address every 2 seconds and shows which environment answered.',
          )}
        </p>
      </header>

      <form
        onSubmit={apply}
        className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="watch-guest" className="text-label">
            {t('Guest address')}
          </Label>
          <Input
            id="watch-guest"
            value={guestDraft}
            onChange={(event) => setGuestDraft(event.target.value)}
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="watch-watcher" className="text-label">
            {t('Watcher address (optional)')}
          </Label>
          <Input
            id="watch-watcher"
            value={watcherDraft}
            onChange={(event) => setWatcherDraft(event.target.value)}
            className="font-mono"
          />
        </div>
        <Button type="submit">{t('Apply')}</Button>
      </form>

      <section
        aria-label={t('Responding environment')}
        className={cn(
          'flex flex-col gap-2 rounded-xl border bg-surface p-4',
          failingNow ? 'border-danger-solid' : 'border-line',
        )}
      >
        <span className="text-caption text-fg-muted">{t('Responding environment')}</span>
        <div className="flex flex-wrap items-center gap-3">
          {kind ? (
            <>
              <span aria-hidden className={cn('size-6 rounded-full', KIND_BG[kind])} />
              <output data-testid="watch-environment" className="text-h1">
                {kindLabel(kind)}
              </output>
              <span className="font-mono text-mono text-fg-secondary">{watch.current}</span>
            </>
          ) : (
            <output data-testid="watch-environment" className="text-h1 text-fg-muted">
              {watch.total === 0 ? t('Checking…') : t('No response yet')}
            </output>
          )}
        </div>
        {failingNow && (
          <p className="text-body-medium text-danger-fg">
            {t('The last request failed ({{reason}}). Retrying every 2 seconds.', {
              reason: last?.status ? `HTTP ${last.status}` : t('no response'),
            })}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t('Requests')} value={String(watch.total)} />
        <Stat
          label={t('Failures')}
          value={String(watch.failures)}
          tone={watch.failures > 0 ? 'danger' : 'success'}
        />
        <Stat
          label={t('Last switch')}
          value={watch.lastSwitch ? clock(watch.lastSwitch.at) : '—'}
          caption={
            watch.lastSwitch
              ? `${kindLabel(watchKind(watch.lastSwitch.from))} → ${kindLabel(watchKind(watch.lastSwitch.to))}`
              : t('No switch seen yet')
          }
        />
        <Stat
          label={t('Switch took')}
          value={watch.lastSwitch ? `${watch.lastSwitch.seconds.toFixed(1)} s` : '—'}
          caption={t('last answer from the old environment → first answer from the new one')}
        />
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-title">
            {t('Last {{n}} requests (oldest on the left)', { n: WATCH_STRIP_SIZE })}
          </h2>
          <Legend />
        </div>
        <div data-testid="watch-strip" className="flex h-10 gap-0.5">
          {Array.from({ length: WATCH_STRIP_SIZE }, (_, index) => {
            const offset = WATCH_STRIP_SIZE - watch.samples.length;
            const sample = index >= offset ? watch.samples[index - offset] : undefined;
            const fill = !sample
              ? 'bg-subtle'
              : sample.environment === null
                ? 'bg-danger-solid'
                : KIND_BG[watchKind(sample.environment)];
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: 칸 자리 자체가 순서다
                key={index}
                data-kind={
                  sample
                    ? sample.environment === null
                      ? 'fail'
                      : watchKind(sample.environment)
                    : 'empty'
                }
                title={sample ? (sample.environment ?? t('Failed')) : undefined}
                className={cn('flex-1 rounded-sm', fill)}
              />
            );
          })}
        </div>
      </section>

      {watcherHost && (
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
                ` · ${t('promoted {{time}}', { time: clock(Date.parse(watcher.data.watcher.promotedAt)) })}`}
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
      )}

      <p className="text-caption text-fg-muted">
        {t(
          'Requests go through app.echoport.uk/onprem-probe because the guest address does not allow other sites to read it. Nothing is stored on the EchoPort server.',
        )}
      </p>
    </main>
  );
}

function Stat({
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

function Legend() {
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
