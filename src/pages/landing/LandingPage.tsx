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
    // 큰 글자에서 한글이 단어 중간에 끊기지 않게 한다. 일본어는 띄어쓰기가 없어 넘치므로 한국어만
    <div className="min-h-dvh overflow-x-clip bg-canvas [&:lang(ko)]:break-keep">
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
