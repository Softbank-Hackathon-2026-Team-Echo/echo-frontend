import {
  type GlobeArc,
  type GlobeIsland,
  type GlobeRegion,
  OrthoGlobe,
} from '@/components/OrthoGlobe';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// 환경 종류별 주요 리전(색 = provider). 같은 도시의 리전은 겹치지 않게 조금씩 비켜 찍는다.
// 시연 3곳(도쿄 AWS · 서울 GCP · 후쿠오카 온프레)은 크게 강조한다
const REGIONS: GlobeRegion[] = [
  // AWS
  {
    key: 'aws-tokyo',
    label: 'AWS · Tokyo',
    lat: 35.68,
    lng: 139.69,
    provider: 'aws',
    highlight: true,
  },
  { key: 'aws-osaka', label: 'AWS · Osaka', lat: 34.69, lng: 135.5, provider: 'aws' },
  { key: 'aws-seoul', label: 'AWS · Seoul', lat: 37.2, lng: 127.4, provider: 'aws' },
  { key: 'aws-singapore', label: 'AWS · Singapore', lat: 1.6, lng: 103.6, provider: 'aws' },
  { key: 'aws-hongkong', label: 'AWS · Hong Kong', lat: 22.3, lng: 114.2, provider: 'aws' },
  { key: 'aws-mumbai', label: 'AWS · Mumbai', lat: 19.08, lng: 72.88, provider: 'aws' },
  { key: 'aws-sydney', label: 'AWS · Sydney', lat: -33.87, lng: 151.21, provider: 'aws' },
  { key: 'aws-frankfurt', label: 'AWS · Frankfurt', lat: 50.11, lng: 8.68, provider: 'aws' },
  { key: 'aws-ireland', label: 'AWS · Ireland', lat: 53.35, lng: -6.26, provider: 'aws' },
  { key: 'aws-virginia', label: 'AWS · N. Virginia', lat: 38.9, lng: -77.4, provider: 'aws' },
  { key: 'aws-oregon', label: 'AWS · Oregon', lat: 45.6, lng: -121.2, provider: 'aws' },
  { key: 'aws-saopaulo', label: 'AWS · São Paulo', lat: -23.55, lng: -46.63, provider: 'aws' },
  // GCP
  {
    key: 'gcp-seoul',
    label: 'GCP · Seoul',
    lat: 37.57,
    lng: 126.98,
    provider: 'gcp',
    highlight: true,
  },
  { key: 'gcp-tokyo', label: 'GCP · Tokyo', lat: 36.1, lng: 140.1, provider: 'gcp' },
  { key: 'gcp-osaka', label: 'GCP · Osaka', lat: 34.4, lng: 135.9, provider: 'gcp' },
  { key: 'gcp-taiwan', label: 'GCP · Taiwan', lat: 24.1, lng: 120.7, provider: 'gcp' },
  { key: 'gcp-singapore', label: 'GCP · Singapore', lat: 1.1, lng: 104.1, provider: 'gcp' },
  { key: 'gcp-jakarta', label: 'GCP · Jakarta', lat: -6.2, lng: 106.8, provider: 'gcp' },
  { key: 'gcp-sydney', label: 'GCP · Sydney', lat: -34.2, lng: 150.8, provider: 'gcp' },
  { key: 'gcp-belgium', label: 'GCP · Belgium', lat: 50.45, lng: 3.82, provider: 'gcp' },
  { key: 'gcp-iowa', label: 'GCP · Iowa', lat: 41.26, lng: -95.86, provider: 'gcp' },
  { key: 'gcp-oregon', label: 'GCP · Oregon', lat: 45.2, lng: -121.6, provider: 'gcp' },
  // Azure
  { key: 'azure-korea', label: 'Azure · Korea Central', lat: 37.9, lng: 126.6, provider: 'azure' },
  { key: 'azure-japan', label: 'Azure · Japan East', lat: 35.3, lng: 139.3, provider: 'azure' },
  { key: 'azure-hongkong', label: 'Azure · East Asia', lat: 22.6, lng: 113.8, provider: 'azure' },
  {
    key: 'azure-singapore',
    label: 'Azure · Southeast Asia',
    lat: 1.35,
    lng: 103.2,
    provider: 'azure',
  },
  { key: 'azure-india', label: 'Azure · Central India', lat: 18.52, lng: 73.86, provider: 'azure' },
  {
    key: 'azure-australia',
    label: 'Azure · Australia East',
    lat: -33.5,
    lng: 151.6,
    provider: 'azure',
  },
  {
    key: 'azure-netherlands',
    label: 'Azure · West Europe',
    lat: 52.37,
    lng: 4.9,
    provider: 'azure',
  },
  { key: 'azure-virginia', label: 'Azure · East US', lat: 37.4, lng: -78.2, provider: 'azure' },
  // 온프레
  {
    key: 'onprem-fukuoka',
    label: 'On-prem · Fukuoka',
    lat: 33.59,
    lng: 130.4,
    provider: 'onprem',
    highlight: true,
  },
  { key: 'onprem-busan', label: 'On-prem · Busan', lat: 35.18, lng: 129.08, provider: 'onprem' },
  {
    key: 'onprem-sapporo',
    label: 'On-prem · Sapporo',
    lat: 43.06,
    lng: 141.35,
    provider: 'onprem',
  },
  { key: 'onprem-taipei', label: 'On-prem · Taipei', lat: 25.03, lng: 121.56, provider: 'onprem' },
];

// 대피 경로: 시연(도쿄 → 서울 · 후쿠오카)과 클라우드 사이 이동
const ARCS: GlobeArc[] = [
  { from: 'aws-tokyo', to: 'gcp-seoul' },
  { from: 'aws-tokyo', to: 'onprem-fukuoka' },
  { from: 'gcp-seoul', to: 'azure-singapore' },
  { from: 'aws-osaka', to: 'gcp-oregon' },
  { from: 'azure-japan', to: 'onprem-busan' },
  { from: 'gcp-taiwan', to: 'aws-mumbai' },
  { from: 'aws-singapore', to: 'azure-australia' },
  { from: 'onprem-sapporo', to: 'aws-virginia' },
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
