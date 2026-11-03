import { type GlobeArc, type GlobeRegion, OrthoGlobe } from '@/components/OrthoGlobe';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// 시연 3곳은 색으로, 나머지는 EchoPort 가 붙일 수 있는 주요 리전(작은 점)
const REGIONS: GlobeRegion[] = [
  { key: 'tokyo', label: 'AWS · Tokyo', lat: 35.68, lng: 139.69, tone: 'danger' },
  { key: 'seoul', label: 'GCP · Seoul', lat: 37.57, lng: 126.98, tone: 'migrating' },
  { key: 'fukuoka', label: 'On-prem · Fukuoka', lat: 33.59, lng: 130.4, tone: 'success' },
  { key: 'osaka', label: 'Osaka', lat: 34.69, lng: 135.5 },
  { key: 'taiwan', label: 'Taiwan', lat: 24.1, lng: 120.7 },
  { key: 'singapore', label: 'Singapore', lat: 1.35, lng: 103.82 },
  { key: 'sydney', label: 'Sydney', lat: -33.87, lng: 151.21 },
  { key: 'mumbai', label: 'Mumbai', lat: 19.08, lng: 72.88 },
  { key: 'frankfurt', label: 'Frankfurt', lat: 50.11, lng: 8.68 },
  { key: 'ireland', label: 'Ireland', lat: 53.35, lng: -6.26 },
  { key: 'virginia', label: 'N. Virginia', lat: 38.9, lng: -77.4 },
  { key: 'oregon', label: 'Oregon', lat: 45.6, lng: -121.2 },
  { key: 'saopaulo', label: 'São Paulo', lat: -23.55, lng: -46.63 },
];

// 대피 경로: 시연(도쿄 → 서울 · 후쿠오카)과 다른 리전 사이 이동
const ARCS: GlobeArc[] = [
  { from: 'tokyo', to: 'seoul' },
  { from: 'tokyo', to: 'fukuoka' },
  { from: 'seoul', to: 'singapore' },
  { from: 'osaka', to: 'oregon' },
  { from: 'singapore', to: 'sydney' },
  { from: 'taiwan', to: 'mumbai' },
];

// 동아시아가 정면 조금 위에 오게 (아래쪽은 대시보드 그림이 덮는다)
const CENTER: [number, number] = [128, -4];

/** 히어로 지구본. 육지는 면, 리전은 점, 대피 경로는 항로처럼 떠오르는 곡선. 움직임 줄이기면 멈춘다 */
export function HeroGlobe({ className }: { className?: string }) {
  const isReducedMotion = usePrefersReducedMotion();
  return (
    <OrthoGlobe
      regions={REGIONS}
      arcs={ARCS}
      center={CENTER}
      animate={!isReducedMotion}
      className={className}
    />
  );
}
