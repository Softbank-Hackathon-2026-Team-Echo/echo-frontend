import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { githubLoginUrl } from '@/lib/api/auth';
import { BrowserFrame } from './BrowserFrame';
import { DashboardPreview } from './DashboardPreview';
import { HeroGlobe } from './HeroGlobe';
import { Illustration } from './Illustration';

// 지구본 점 색 범례 (환경 종류). Azure 는 provider 토큰이 없어 chart-1 을 쓴다
const PLACES = [
  { label: 'AWS', dot: 'bg-aws' },
  { label: 'GCP', dot: 'bg-gcp' },
  { label: 'Azure', dot: 'bg-chart-1' },
  { label: 'On-prem', dot: 'bg-onprem' },
];

/** L01 히어로: 제목 · CTA · 도는 지구본(환경 종류별 리전 · 대피 경로) · 대시보드 그림 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="mx-auto flex max-w-content flex-col items-center gap-6 px-gutter pt-16 text-center max-compact:px-gutter-compact max-compact:pt-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-small text-fg-secondary shadow-xs">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />
          SoftBank Hackathon 2026 · Frictionless Cloud Management Across Platforms
        </span>
        <h1 id="hero-title" className="text-headline compact:text-display">
          Beyond Lock-In.
          <br />
          <span className="text-brand">Frictionless across clouds.</span>
        </h1>
        <p className="max-w-2xl text-lead text-fg-secondary">
          Run, move and protect live services across AWS, GCP and on-prem from one console — zero
          downtime, the same security everywhere. And when a disaster is coming, EchoPort moves them
          for you.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href={githubLoginUrl('/')}>
              Get started
              <ArrowRight aria-hidden />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
      </div>

      <div className="relative mx-auto mt-8 flex max-w-content flex-col items-center px-gutter max-compact:px-gutter-compact">
        {/* 지구본은 윗부분만 보이고 대시보드 그림이 아래를 덮는다 */}
        <div className="relative h-96 w-full max-w-4xl overflow-hidden max-sm:h-56">
          <div
            aria-hidden
            className="absolute inset-x-0 top-8 mx-auto aspect-square w-full max-w-4xl rounded-full bg-globe-sphere blur-3xl"
          />
          <HeroGlobe className="relative mx-auto aspect-square w-full max-w-4xl" />
          <ul
            aria-label="Environment types on the globe"
            className="absolute inset-x-0 top-6 flex flex-wrap justify-center gap-2"
          >
            {PLACES.map((place) => (
              <li
                key={place.label}
                className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-label shadow-sm"
              >
                <span aria-hidden className={`size-1.5 rounded-full ${place.dot}`} />
                {place.label}
              </li>
            ))}
          </ul>
        </div>
        <Illustration
          label="EchoPort dashboard while a service is being evacuated to GCP Seoul"
          className="relative -mt-20 w-full max-w-5xl max-sm:-mt-12"
          captionClassName="text-center"
        >
          <BrowserFrame url="app.echoport.uk/dashboard" className="h-96 max-sm:h-80">
            <DashboardPreview variant="evacuating" />
          </BrowserFrame>
        </Illustration>
      </div>
    </section>
  );
}
