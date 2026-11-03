import {
  type GlobeArc,
  type GlobeIsland,
  type GlobeRegion,
  OrthoGlobe,
} from '@/components/OrthoGlobe';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// 환경 종류별 리전(색 = provider, 모두 같은 크기). 한국 · 일본은 시연 3곳(서울 GCP · 도쿄 AWS · 후쿠오카 온프레)만 두고,
// 나머지는 세계 여러 나라에 퍼뜨린다
const REGIONS: GlobeRegion[] = [
  // 시연
  { key: 'tokyo', label: 'AWS · Tokyo', lat: 35.68, lng: 139.69, provider: 'aws' },
  { key: 'seoul', label: 'GCP · Seoul', lat: 37.57, lng: 126.98, provider: 'gcp' },
  {
    key: 'fukuoka',
    label: 'On-prem · Fukuoka',
    lat: 33.59,
    lng: 130.4,
    provider: 'onprem',
  },
  // AWS
  { key: 'singapore', label: 'AWS · Singapore', lat: 1.35, lng: 103.82, provider: 'aws' },
  { key: 'mumbai', label: 'AWS · Mumbai', lat: 19.08, lng: 72.88, provider: 'aws' },
  { key: 'frankfurt', label: 'AWS · Frankfurt', lat: 50.11, lng: 8.68, provider: 'aws' },
  { key: 'virginia', label: 'AWS · N. Virginia', lat: 38.9, lng: -77.4, provider: 'aws' },
  { key: 'saopaulo', label: 'AWS · São Paulo', lat: -23.55, lng: -46.63, provider: 'aws' },
  { key: 'capetown', label: 'AWS · Cape Town', lat: -33.92, lng: 18.42, provider: 'aws' },
  // GCP
  { key: 'oregon', label: 'GCP · Oregon', lat: 45.6, lng: -121.2, provider: 'gcp' },
  { key: 'iowa', label: 'GCP · Iowa', lat: 41.26, lng: -95.86, provider: 'gcp' },
  { key: 'london', label: 'GCP · London', lat: 51.51, lng: -0.13, provider: 'gcp' },
  { key: 'jakarta', label: 'GCP · Jakarta', lat: -6.2, lng: 106.8, provider: 'gcp' },
  { key: 'taiwan', label: 'GCP · Taiwan', lat: 24.1, lng: 120.7, provider: 'gcp' },
  { key: 'santiago', label: 'GCP · Santiago', lat: -33.45, lng: -70.67, provider: 'gcp' },
  // Azure
  { key: 'sydney', label: 'Azure · Australia East', lat: -33.87, lng: 151.21, provider: 'azure' },
  { key: 'netherlands', label: 'Azure · West Europe', lat: 52.37, lng: 4.9, provider: 'azure' },
  { key: 'dubai', label: 'Azure · UAE North', lat: 25.2, lng: 55.27, provider: 'azure' },
  { key: 'toronto', label: 'Azure · Canada Central', lat: 43.65, lng: -79.38, provider: 'azure' },
  { key: 'hongkong', label: 'Azure · East Asia', lat: 22.3, lng: 114.2, provider: 'azure' },
  // 온프레
  { key: 'stockholm', label: 'On-prem · Stockholm', lat: 59.33, lng: 18.07, provider: 'onprem' },
  { key: 'mexico', label: 'On-prem · Mexico City', lat: 19.43, lng: -99.13, provider: 'onprem' },
];

// 대피 경로: 노드마다 경로 수가 고르게(대부분 2개) 퍼지도록 짠다. 한국 · 일본도 다른 나라와 같은 수
const ARCS: GlobeArc[] = [
  { from: 'tokyo', to: 'seoul' },
  { from: 'oregon', to: 'tokyo' },
  { from: 'seoul', to: 'london' },
  { from: 'fukuoka', to: 'sydney' },
  { from: 'singapore', to: 'fukuoka' },
  { from: 'mumbai', to: 'singapore' },
  { from: 'dubai', to: 'mumbai' },
  { from: 'stockholm', to: 'dubai' },
  { from: 'toronto', to: 'stockholm' },
  { from: 'netherlands', to: 'virginia' },
  { from: 'capetown', to: 'netherlands' },
  { from: 'frankfurt', to: 'saopaulo' },
  { from: 'jakarta', to: 'frankfurt' },
  { from: 'virginia', to: 'mexico' },
  { from: 'saopaulo', to: 'capetown' },
  { from: 'hongkong', to: 'oregon' },
  { from: 'iowa', to: 'santiago' },
  { from: 'london', to: 'toronto' },
  { from: 'sydney', to: 'jakarta' },
  { from: 'taiwan', to: 'dubai' },
  { from: 'mexico', to: 'taiwan' },
  { from: 'santiago', to: 'hongkong' },
  { from: 'iowa', to: 'hongkong' },
];

// 110m 육지 데이터에 없는 섬. 실제 크기(°) 대로 그리되 화면에서 너무 작으면 최소 크기
const ISLANDS: GlobeIsland[] = [
  { key: 'jeju', lat: 33.38, lng: 126.55, rx: 0.36, ry: 0.15 },
  { key: 'ulleungdo', lat: 37.5, lng: 130.87, rx: 0.06, ry: 0.05 },
  { key: 'dokdo', lat: 37.24, lng: 131.87, rx: 0.02, ry: 0.02 },
];

// 동아시아가 정면 조금 위에 오게 (아래쪽은 대시보드 그림이 덮는다)
const CENTER: [number, number] = [128, -4];

/** 히어로 지구본. 육지·섬은 면, 리전은 환경 종류 색 점, 대피 경로는 항로처럼 떠오르는 곡선 */
export function HeroGlobe({ className }: { className?: string }) {
  const isReducedMotion = usePrefersReducedMotion();
  return (
    <OrthoGlobe
      regions={REGIONS}
      arcs={ARCS}
      islands={ISLANDS}
      center={CENTER}
      animate={!isReducedMotion}
      className={className}
    />
  );
}
