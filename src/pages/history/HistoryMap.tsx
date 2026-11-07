import { useId } from 'react';
import {
  circlePath,
  graticule,
  isInMapBounds,
  MAP_HEIGHT,
  MAP_WIDTH,
  mapPath,
  project,
  useLand,
} from '@/components/disaster/map-base';
import { Panel } from '@/components/Panel';
import {
  type HistoryDetail,
  type HistoryEnvironment,
  type HistoryWeights,
  snapshotEnvironment,
} from '@/lib/disaster-history';
import { t } from '@/lib/i18n';
import { historyImpactLabel, historyRadiusLabel } from '@/lib/status';
import { ProvenanceBadges } from './ProvenanceBadges';

const STAR = 'M0,-7 L2,-2 L7,-2 L3,1 L4.5,6 L0,3 L-4.5,6 L-3,1 L-7,-2 L-2,-2 Z';
const TRIANGLE = 'M0,-6 L6,5 L-6,5 Z';
const DIAMOND = 'M0,-6 L6,0 L0,6 L-6,0 Z';

function EnvironmentMark({ impact }: { impact: string | null }) {
  if (impact === 'AFFECTED')
    return <path d={TRIANGLE} className="fill-danger-solid stroke-surface" />;
  if (impact === 'OUTSIDE') return <circle r={5} className="fill-success-solid stroke-surface" />;
  return <path d={DIAMOND} className="fill-fg-muted stroke-surface" />;
}

function LegendItem({
  shape,
  label,
  className,
}: {
  shape: string;
  label: string;
  className: string;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <svg aria-hidden viewBox="-8 -8 16 16" className="size-3 shrink-0">
        <path d={shape} className={className} />
      </svg>
      {label}
    </li>
  );
}

function environmentWeight(
  environment: HistoryEnvironment,
  detail: HistoryDetail,
  weights: HistoryWeights | null,
): string {
  if (!weights) return '';
  if (environment.id === detail.snapshot?.sourceEnvironmentId) return ` · ${weights.source}%`;
  if (environment.id === detail.snapshot?.targetEnvironmentId) return ` · ${weights.target}%`;
  return '';
}

type HistoryMapProps = {
  detail: HistoryDetail;
  weights: HistoryWeights | null;
  selectedTime: string;
};

/** 조회 전용 지도. 눌러도 재난 입력이 바뀌지 않는다. 원은 피해 범위가 아니라 서버가 준 정책·가정 반경이다 */
export function HistoryMap({ detail, weights, selectedTime }: HistoryMapProps) {
  const land = useLand();
  const arrowId = useId();
  const epicenter = detail.coordinates;
  const inBounds = epicenter ? isInMapBounds(epicenter) : false;
  const environments = detail.snapshot?.environments ?? [];
  const placed = environments.filter(
    (environment) => environment.coordinates && isInMapBounds(environment.coordinates),
  );
  const unplaced = environments.filter((environment) => !placed.includes(environment));
  const source = snapshotEnvironment(detail.snapshot, detail.snapshot?.sourceEnvironmentId ?? null);
  const target = snapshotEnvironment(detail.snapshot, detail.snapshot?.targetEnvironmentId ?? null);
  const from = source?.coordinates ? project(source.coordinates) : null;
  const to = target?.coordinates ? project(target.coordinates) : null;

  return (
    <Panel
      title={t('Map')}
      action={<span className="text-caption text-fg-muted">{selectedTime}</span>}
    >
      <ProvenanceBadges event={detail} />
      <svg
        role="img"
        aria-label={t('Read-only map of the selected past event')}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full rounded-md bg-globe-sphere"
      >
        <title>{t('Past disaster map')}</title>
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="fill-migrating-solid" />
          </marker>
        </defs>
        <path d={graticule} className="fill-none stroke-globe-grid" />
        {land && (
          <>
            <path
              d={mapPath(land.countries) ?? ''}
              className="fill-globe-land stroke-globe-coast"
            />
            <path
              d={mapPath(land.borders) ?? ''}
              className="fill-none stroke-globe-coast"
              strokeDasharray="2 2"
            />
          </>
        )}
        {epicenter && inBounds && detail.radius && (
          <path
            data-testid="history-radius"
            d={circlePath(epicenter, detail.radius.km)}
            className="fill-warning-bg stroke-warning-solid"
            fillOpacity={0.5}
            strokeDasharray="4 3"
          />
        )}
        {from && to && (
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            markerEnd={`url(#${arrowId})`}
            className="stroke-migrating-solid"
            strokeWidth={1.5}
            strokeDasharray={weights ? undefined : '3 3'}
          />
        )}
        {placed.map((environment) => {
          const point = project(environment.coordinates ?? { lat: 0, lng: 0 });
          return (
            <g key={environment.id} transform={`translate(${point.x} ${point.y})`}>
              <EnvironmentMark impact={environment.impact} />
              <text x={8} y={12} className="fill-fg text-caption">
                {environment.name}
                {environmentWeight(environment, detail, weights)}
              </text>
            </g>
          );
        })}
        {epicenter && inBounds && (
          <path
            d={STAR}
            transform={`translate(${project(epicenter).x} ${project(epicenter).y})`}
            className="fill-danger-solid"
          />
        )}
      </svg>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-fg-secondary">
        <LegendItem shape={STAR} label={t('Epicenter')} className="fill-danger-solid" />
        <LegendItem
          shape={TRIANGLE}
          label={historyImpactLabel('AFFECTED')}
          className="fill-danger-solid"
        />
        <LegendItem
          shape="M6,0 A6,6 0 1,1 -6,0 A6,6 0 1,1 6,0 Z"
          label={historyImpactLabel('OUTSIDE')}
          className="fill-success-solid"
        />
        <LegendItem shape={DIAMOND} label={historyImpactLabel(null)} className="fill-fg-muted" />
      </ul>
      <div className="flex flex-col gap-1 text-small text-fg-secondary">
        {detail.radius ? (
          <p>
            {t('{{label}} · {{km}} km', {
              label: historyRadiusLabel(detail.radius.source),
              km: detail.radius.km,
            })}
            {detail.radius.basis ? ` · ${detail.radius.basis}` : ''}
            {' · '}
            {t('Not the actual damage area.')}
          </p>
        ) : (
          <p>
            {t('No circle is drawn: {{reason}}', {
              reason: detail.radiusMissingReason ?? t('the server gave no radius or basis.'),
            })}
          </p>
        )}
        <p>
          {detail.shakeMapUrl ? (
            <a
              href={detail.shakeMapUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              {t('Open USGS ShakeMap')}
            </a>
          ) : (
            t('USGS ShakeMap: no data')
          )}
        </p>
        {!epicenter && <p>{t('Epicenter coordinates are not available.')}</p>}
        {epicenter && !inBounds && (
          <p>{t('This event is outside the map area (Japan and Korea).')}</p>
        )}
        {unplaced.length > 0 && (
          <p>
            {t('Not on the map: {{names}}', {
              names: unplaced.map((environment) => environment.name).join(', '),
            })}
          </p>
        )}
      </div>
    </Panel>
  );
}
