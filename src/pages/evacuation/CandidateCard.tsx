import { ProviderLabel } from '@/components/ProviderLabel';
import type { EvacuationCandidate } from '@/lib/api/evacuation';
import { SCORE_RULES } from '@/lib/api/evacuation';
import type { EnvironmentSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-27 shrink-0 text-small text-fg-secondary">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-xs bg-subtle">
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-xs',
            value >= 70 ? 'bg-success-solid' : value >= 50 ? 'bg-warning-solid' : 'bg-danger-solid',
          )}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="w-6 text-right font-mono text-mono tabular-nums">{value}</span>
    </div>
  );
}

/** 대피 후보 카드. 고르면 브랜드 바탕 + 2px 테두리 */
export function CandidateCard({
  candidate,
  environment,
  selected,
  onSelect,
}: {
  candidate: EvacuationCandidate;
  environment: EnvironmentSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        'flex flex-col gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus',
        selected ? 'border-brand bg-brand-subtle' : 'border-line bg-surface hover:bg-subtle',
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <input
            type="radio"
            name="evacuation-target"
            value={environment.id}
            checked={selected}
            onChange={onSelect}
            className="size-4 accent-brand"
          />
          <span className="rounded-sm border border-line bg-surface px-1.5 text-label">
            <ProviderLabel kind={environment.kind} showLocation={false} />
          </span>
          <span className="truncate text-title">{environment.name}</span>
        </span>
        {candidate.recommended && (
          <span className="rounded-sm bg-brand-subtle px-2 py-0.5 text-label text-brand-on-subtle">
            {t('Recommended')}
          </span>
        )}
      </span>
      <span className="flex items-end gap-1.5">
        <span className="text-metric tabular-nums">{candidate.score}</span>
        <span className="text-small text-fg-secondary">{t('/ 100 overall')}</span>
      </span>
      <span className="flex flex-col gap-2">
        {SCORE_RULES.map((rule) => (
          <ScoreBar key={rule.key} label={rule.label} value={candidate.scores[rule.key]} />
        ))}
      </span>
      <ul className="flex flex-wrap gap-1.5">
        {candidate.reasons.map((reason) => (
          <li
            key={reason}
            className="rounded-sm bg-subtle px-2 py-0.5 text-caption text-fg-secondary"
          >
            {reason}
          </li>
        ))}
      </ul>
    </label>
  );
}
