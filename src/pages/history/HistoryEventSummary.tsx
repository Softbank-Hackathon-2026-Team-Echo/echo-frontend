import type { ReactNode } from 'react';
import { Panel } from '@/components/Panel';
import {
  type HistoryDetail,
  type HistoryWeights,
  snapshotEnvironment,
} from '@/lib/disaster-history';
import { fullDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { ProvenanceBadges } from './ProvenanceBadges';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-body break-words">{children}</dd>
    </div>
  );
}

function WeightBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex justify-between gap-2 text-small">
        <span className="truncate">{name}</span>
        <span className="font-mono text-mono tabular-nums">{value}%</span>
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
        <div
          className="h-full bg-migrating-solid transition-[width] motion-reduce:transition-none"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

type HistoryEventSummaryProps = {
  detail: HistoryDetail;
  weights: HistoryWeights | null;
  selectedTime: string;
};

/** 고른 사건의 원본 값과 그 시점 서비스 상태. 지금 환경 값으로 채우지 않는다 */
export function HistoryEventSummary({ detail, weights, selectedTime }: HistoryEventSummaryProps) {
  const unknown = t("Can't confirm");
  const { snapshot } = detail;
  const source = snapshotEnvironment(snapshot, snapshot?.sourceEnvironmentId ?? null);
  const target = snapshotEnvironment(snapshot, snapshot?.targetEnvironmentId ?? null);
  const occurredAt = detail.occurredAt ? fullDateTime(detail.occurredAt, detail.timeZone) : unknown;

  return (
    <Panel title={detail.place ?? t('Place unknown')} action={<ProvenanceBadges event={detail} />}>
      <dl className="grid grid-cols-2 gap-3 wide:grid-cols-4">
        <Field label={t('Source event ID')}>
          <span className="font-mono text-mono">{detail.sourceEventId ?? unknown}</span>
        </Field>
        <Field label={t('Occurred')}>{occurredAt}</Field>
        <Field label={t('Retrieved')}>
          {detail.fetchedAt ? fullDateTime(detail.fetchedAt, detail.timeZone) : unknown}
        </Field>
        <Field label={t('Selected replay time')}>{selectedTime}</Field>
        <Field label={t('Magnitude')}>
          {detail.magnitude === null ? unknown : `M${detail.magnitude.toFixed(1)}`}
        </Field>
        <Field label={t('Depth')}>
          {detail.depthKm === null ? '—' : t('{{km}} km', { km: detail.depthKm })}
        </Field>
        <Field label={t('Coordinates')}>
          {detail.coordinates
            ? `${detail.coordinates.lat.toFixed(2)}, ${detail.coordinates.lng.toFixed(2)}`
            : unknown}
        </Field>
        <Field label={t('Original record')}>
          {detail.sourceUrl ? (
            <a
              href={detail.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              {t('Open record')}
            </a>
          ) : (
            unknown
          )}
        </Field>
      </dl>
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="text-title">{t('At this point')}</h3>
        {snapshot ? (
          <>
            <p className="text-small text-fg-secondary">
              {t('{{service}}: {{from}} → {{to}}', {
                service: snapshot.serviceName ?? unknown,
                from: source?.name ?? unknown,
                to: target?.name ?? unknown,
              })}
            </p>
            {weights ? (
              <div className="grid gap-2 compact:grid-cols-2">
                <WeightBar name={source?.name ?? unknown} value={weights.source} />
                <WeightBar name={target?.name ?? unknown} value={weights.target} />
              </div>
            ) : (
              <p className="text-small text-fg-muted">{t('No traffic weight recorded yet.')}</p>
            )}
          </>
        ) : (
          <p className="text-small text-fg-muted">
            {t("Can't confirm the services and environments at that time.")}
          </p>
        )}
      </div>
    </Panel>
  );
}
