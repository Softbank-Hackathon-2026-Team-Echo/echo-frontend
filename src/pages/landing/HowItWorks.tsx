import { useRef } from 'react';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Illustration } from './Illustration';
import { SectionIntro } from './SectionIntro';
import { StepMini } from './StepMini';
import { TitleLines } from './TitleLines';
import { useInView } from './useInView';

const STEPS = [
  {
    key: 'detect',
    title: k('Detect'),
    body: k(
      'A disaster alert becomes an epicenter and a radius. Environments inside it turn at risk.',
    ),
    label: k('An M7.2 alert near Tokyo marks aws-tokyo-prod at risk'),
  },
  {
    key: 'choose',
    title: k('Choose'),
    body: k(
      'Registered environments outside the radius are ranked by safety, capacity, cost and failback time.',
    ),
    label: k('gcp-seoul-standby scores 82 and onprem-fukuoka 74'),
  },
  {
    key: 'test',
    title: k('Test'),
    body: k(
      'An AI agent replays the app on the target in a sandbox and proposes patches for any gaps.',
    ),
    label: k(
      'A patch raises max_connections from 100 to 200 and the sandbox passes 12 of 12 checks',
    ),
  },
  {
    key: 'move',
    title: k('Move'),
    body: k('Traffic shifts 10 → 50 → 100%. The database writer switches with LSN checks.'),
    label: k('Traffic is 30% on Tokyo and 70% on Seoul and the writer cutover matched the LSN'),
  },
] as const;

const REVEAL_STAGGER_MS = 150;

/** L01 ③ 4단계. 화면에 들어오면 카드가 차례로 나타난다(움직임 줄이기면 바로 보인다) */
export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const isInView = useInView(listRef);

  return (
    <section className="mx-auto flex max-w-content flex-col gap-12 px-gutter py-20 max-compact:px-gutter-compact">
      <SectionIntro
        id="how-it-works"
        title={<TitleLines text={t('From warning<br>to safe region in minutes')} />}
        description={t(
          'Four steps run in order. You approve once; EchoPort does the rest and measures every second of it.',
        )}
        link={{ label: t('See the full flow'), to: '#features' }}
      />
      <ol
        ref={listRef}
        className="grid grid-cols-4 gap-4 max-compact:grid-cols-2 max-sm:grid-cols-1"
      >
        {STEPS.map((step, index) => (
          <li
            key={step.key}
            style={{ transitionDelay: `${index * REVEAL_STAGGER_MS}ms` }}
            className={cn(
              'flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs motion-safe:transition-all motion-safe:duration-500',
              !isInView && 'motion-safe:translate-y-4 motion-safe:opacity-0',
            )}
          >
            <span className="w-fit rounded-xs bg-brand px-1.5 text-label text-fg-on-brand">
              {index + 1}
            </span>
            <h3 className="text-h2">{t(step.title)}</h3>
            <p className="text-body text-fg-secondary">{t(step.body)}</p>
            <Illustration label={t(step.label)} className="mt-auto">
              <StepMini step={step.key} />
            </Illustration>
          </li>
        ))}
      </ol>
    </section>
  );
}
