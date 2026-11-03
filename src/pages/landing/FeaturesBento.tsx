import { Ban, CircleCheck, Database } from 'lucide-react';
import type { ReactNode } from 'react';
import { StageList } from '@/components/StageList';
import { cn } from '@/lib/utils';
import { AuditRows } from './AuditRows';
import { Illustration } from './Illustration';
import { PatchPreview } from './PatchPreview';
import { SectionIntro } from './SectionIntro';
import { SecurityMatrix } from './SecurityMatrix';

function Cell({
  overline,
  title,
  body,
  children,
  label,
  className,
}: {
  overline: string;
  title: string;
  body: string;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <article className={cn('flex flex-col gap-5 p-6 max-sm:p-4', className)}>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-mono text-brand uppercase">{overline}</span>
        <h3 className="text-h2">{title}</h3>
        <p className="text-body text-fg-secondary">{body}</p>
      </div>
      <Illustration label={label}>{children}</Illustration>
    </article>
  );
}

function CutoverCard() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-title">
          <Database aria-hidden className="size-4" />
          DB writer cutover
        </span>
        <span className="font-mono text-mono text-fg-muted">LSN 0/3A1F2C8</span>
      </span>
      <StageList
        stages={[
          { key: 'pause', title: 'Pause writes', meta: '12:05:01 · 0.8s', state: 'done' },
          { key: 'fence', title: 'Fence old writer', meta: 'STONITH ok', state: 'done' },
          { key: 'lsn', title: 'Confirm WAL LSN', meta: 'Waiting for replica…', state: 'current' },
          { key: 'promote', title: 'Promote new writer', meta: '—', state: 'pending' },
        ]}
      />
    </div>
  );
}

function FailbackNotes() {
  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-2 rounded-md bg-subtle px-3 py-2.5 text-small text-fg-secondary">
        <Ban aria-hidden className="size-4 shrink-0" />
        Failback to aws-tokyo-prod locked · M7.2 event still active
      </span>
      <span className="flex items-center gap-2 rounded-md bg-success-bg px-3 py-2.5 text-small text-success-fg">
        <CircleCheck aria-hidden className="size-4 shrink-0" />
        Tokyo is safe again · 0 missing · 0 duplicate rows
      </span>
    </div>
  );
}

/** L01 ⑤ 기능 벤토: 무중단 전환 · AI 사전 점검 · 보안 매트릭스(가로 전체) · 안전할 때만 복귀 · 감사 기록 */
export function FeaturesBento() {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-12 px-gutter py-20 max-compact:px-gutter-compact">
      <SectionIntro
        id="features"
        title={
          <>
            Everything you need
            <br />
            to evacuate safely
          </>
        }
        description="Built for the moment it matters: no lost writes, no surprise config gaps, no silent security drift."
      />
      <div className="grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-surface max-compact:grid-cols-1">
        <Cell
          overline="Data"
          title="Zero-downtime cutover"
          body="Writes pause for under two seconds while the database writer moves. LSN checks prove nothing was lost."
          label="Database writer cutover steps with LSN confirmation"
          className="border-r border-b border-line max-compact:border-r-0"
        >
          <CutoverCard />
        </Cell>
        <Cell
          overline="AI agent"
          title="AI pre-check in a sandbox"
          body="The agent finds config and feature gaps between clouds and proposes a patch you can read line by line."
          label="An AI patch for postgresql.conf waiting for approval"
          className="border-b border-line"
        >
          <PatchPreview />
        </Cell>
        <div className="col-span-2 grid grid-cols-5 items-center gap-6 border-b border-line p-6 max-compact:col-span-1 max-compact:grid-cols-1 max-sm:p-4">
          <div className="col-span-2 flex flex-col gap-2 max-compact:col-span-1">
            <span className="font-mono text-mono text-brand uppercase">Security</span>
            <h3 className="text-h2">Same security, everywhere</h3>
            <p className="text-body text-fg-secondary">
              One policy runs on every environment. If the target is weaker than the source, the
              move is blocked until it is fixed.
            </p>
          </div>
          <Illustration
            label="Security matrix with a violation on gcp-seoul-standby"
            className="col-span-3 max-compact:col-span-1"
          >
            <SecurityMatrix />
          </Illustration>
        </div>
        <Cell
          overline="Failback"
          title="Fails back only when it’s safe"
          body="Reverse sync keeps the original site warm. Failback stays locked until the disaster in that region is over."
          label="Failback is locked while the M7.2 event is active"
          className="border-r border-line max-compact:border-r-0 max-compact:border-b"
        >
          <FailbackNotes />
        </Cell>
        <Cell
          overline="Audit"
          title="Every action, on the record"
          body="People, the AI agent and the system all leave the same audit trail: who did what, to which environment, with what result."
          label="Three audit records from a person, the AI agent and the system"
        >
          <AuditRows />
        </Cell>
      </div>
    </section>
  );
}
