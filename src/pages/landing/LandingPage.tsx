import { FeaturesBento } from './FeaturesBento';
import { FinalCta } from './FinalCta';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import { ProductShowcase } from './ProductShowcase';
import { RegionsStrip } from './RegionsStrip';
import { Statement } from './Statement';
import { SupportStrip } from './SupportStrip';
import { TargetNumbers } from './TargetNumbers';

/** L01 소개 화면. 로그인 전 방문자가 `/` 에서 본다 */
export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-canvas">
      <LandingHeader />
      <main>
        <Hero />
        <SupportStrip />
        <Statement />
        <HowItWorks />
        <ProductShowcase />
        <FeaturesBento />
        <TargetNumbers />
        <RegionsStrip />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
