import { ArrowRight } from 'lucide-react';
import markInverse from '@/assets/logo/mark-inverse.svg';
import { Button } from '@/components/ui/button';
import { githubLoginUrl } from '@/lib/api/auth';

/** L01 ⑧ 어두운 마지막 CTA 카드 */
export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta"
      className="mx-auto max-w-content px-gutter py-20 max-compact:px-gutter-compact"
    >
      <div className="flex items-center justify-between gap-10 rounded-2xl bg-inverse p-16 max-compact:p-8">
        <div className="flex flex-col items-start gap-5">
          <h2 id="final-cta" className="text-h1 text-fg-inverse compact:text-headline">
            Run your first
            <br />
            disaster drill in 5 minutes
          </h2>
          <p className="max-w-xl text-lead-sm text-fg-inverse/70">
            Connect two environments, deploy a sample app, press the button. Nothing in production
            moves until you approve.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={githubLoginUrl('/')}>
                Get started
                <ArrowRight aria-hidden />
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
        </div>
        <img
          src={markInverse}
          alt=""
          width={24}
          height={24}
          className="size-48 shrink-0 opacity-90 max-compact:hidden"
        />
      </div>
    </section>
  );
}
