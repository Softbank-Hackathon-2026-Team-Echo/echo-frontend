import { ArrowRight, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useMigrationPlan } from '@/lib/api/migrations';
import type { MigrationPlanSummary } from '@/lib/api/types';
import { t } from '@/lib/i18n';
import {
  failedRequests,
  requestCount,
  totalSeconds,
  writePauseCaption,
  writePauseText,
} from '@/lib/migration-metrics';
import { duration } from '@/lib/migration-stages';

// 방금 끝난 이전만 카드로 띄운다. 오래된 기록이 대시보드를 열 때마다 뜨지 않게
const RECENT_MS = 30 * 60_000;

function seenKey(orgId: string) {
  return `echoport.completion-seen.${orgId}`;
}

function loadSeen(orgId: string): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(seenKey(orgId)) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveSeen(orgId: string, ids: string[]) {
  try {
    window.sessionStorage.setItem(seenKey(orgId), JSON.stringify(ids));
  } catch {
    // 저장하지 못하면 이번 화면에서만 닫힌다
  }
}

/** 카드로 보여 줄 방금 끝난(성공) 이전. 없으면 undefined */
export function recentCompletion(orgId: string, plans: MigrationPlanSummary[], now = Date.now()) {
  const seen = new Set(loadSeen(orgId));
  return plans.find(
    (plan) =>
      plan.status === 'SUCCEEDED' &&
      plan.finishedAt !== null &&
      now - Date.parse(plan.finishedAt) < RECENT_MS &&
      !seen.has(plan.id),
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-subtle p-3">
      <span className="text-small text-fg-secondary">{label}</span>
      <span className="text-metric-xl tabular-nums">{value}</span>
      <span className="text-caption text-fg-muted">{caption}</span>
    </div>
  );
}

/**
 * 트래픽이 100% 넘어가면 대시보드에 뜨는 완료 카드(IA 11/2). 발표자가 "View full result" 를 눌러 M02 Result 로 간다.
 * 자동으로 넘어가지 않는다
 */
export function CompletionCard({
  orgId,
  orgSlug,
  planId,
  sourceName,
  targetName,
}: {
  orgId: string;
  orgSlug: string;
  planId: string;
  sourceName: string;
  targetName: string;
}) {
  const plan = useMigrationPlan(orgId, planId);
  const [open, setOpen] = useState(true);

  function dismiss() {
    saveSeen(orgId, [...loadSeen(orgId), planId]);
    setOpen(false);
  }

  if (!plan.data) return null;
  const total = totalSeconds(plan.data);
  const failed = failedRequests(plan.data);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex items-start gap-3">
          <CircleCheck aria-hidden className="mt-1 size-6 shrink-0 text-success-solid" />
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-h2">{t('Evacuation complete')}</DialogTitle>
            <DialogDescription>
              {t('{{source}} → {{target}} · migration {{id}}', {
                source: sourceName,
                target: targetName,
                id: planId.slice(0, 8),
              })}
            </DialogDescription>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={t('Total time')}
            value={total === null ? '—' : duration(total)}
            caption={t('planned {{duration}}', { duration: duration(plan.data.expectedSeconds) })}
          />
          <Stat
            label={t('Failed requests')}
            value={failed === null ? '—' : String(failed)}
            caption={t('of {{total}} judged requests', { total: requestCount(plan.data) })}
          />
          <Stat
            label={t('Write pause')}
            value={writePauseText(plan.data) ?? '—'}
            caption={writePauseCaption(plan.data)}
          />
          <Stat
            label={t('Data loss (RPO)')}
            value="—"
            caption={t('measured by the replication engine')}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={dismiss}>
            {t('Stay on dashboard')}
          </Button>
          <Button asChild>
            <Link to={`/o/${orgSlug}/migrations/${planId}`} onClick={dismiss}>
              {t('View full result')} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
