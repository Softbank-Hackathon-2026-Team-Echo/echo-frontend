import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import type { HistoryDetail } from '@/lib/disaster-history';
import { fullDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { historyStepKindLabel, historyStepStatusView } from '@/lib/status';
import { cn } from '@/lib/utils';
import { ProvenanceBadges } from './ProvenanceBadges';
import type { useReplay } from './useReplay';

type HistoryTimelineProps = { detail: HistoryDetail; replay: ReturnType<typeof useReplay> };

/** 기록된 단계만 시각 순서대로 그린다. 조작은 화면에서 고른 단계만 바꾸고 서버를 부르지 않는다 */
export function HistoryTimeline({ detail, replay }: HistoryTimelineProps) {
  const { steps } = detail;
  const { index, isPlaying, lastIndex, seek, togglePlay } = replay;

  return (
    <Panel title={t('Timeline')}>
      <ProvenanceBadges event={detail} />
      {steps.length === 0 ? (
        <p className="text-small text-fg-muted">
          {t(
            'No migration history was recorded for this event. This does not mean nothing happened.',
          )}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t('Previous step')}
              disabled={index === 0}
              onClick={() => seek(index - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button variant="outline" size="sm" onClick={togglePlay}>
              {isPlaying ? <Pause aria-hidden /> : <Play aria-hidden />}
              {isPlaying ? t('Pause') : t('Play')}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t('Next step')}
              disabled={index >= lastIndex}
              onClick={() => seek(index + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
            <input
              type="range"
              aria-label={t('Replay position')}
              min={0}
              max={lastIndex}
              value={index}
              onChange={(event) => seek(Number(event.target.value))}
              className="min-w-24 flex-1 accent-brand"
            />
            <span className="text-caption text-fg-muted tabular-nums">
              {index + 1} / {steps.length}
            </span>
          </div>
          <p className="text-caption text-fg-muted">
            {t('Playback speed is not real time. Only recorded steps are shown.')}
          </p>
          <ol className="flex flex-col gap-1">
            {steps.map((step, position) => (
              <li key={step.id}>
                <button
                  type="button"
                  aria-current={position === index ? 'step' : undefined}
                  onClick={() => seek(position)}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-md p-2 text-left hover:bg-subtle',
                    position === index && 'bg-brand-subtle hover:bg-brand-subtle',
                  )}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-body-medium">{historyStepKindLabel(step.kind)}</span>
                    <StatusBadge {...historyStepStatusView(step.status)} />
                  </span>
                  <span className="text-caption text-fg-muted">
                    {step.at ? fullDateTime(step.at, detail.timeZone) : t('Time not recorded')}
                    {step.sourceWeight !== null && step.targetWeight !== null
                      ? ` · ${step.sourceWeight}% → ${step.targetWeight}%`
                      : ''}
                  </span>
                  {step.reason && (
                    <span className="text-small text-fg-secondary">{step.reason}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
