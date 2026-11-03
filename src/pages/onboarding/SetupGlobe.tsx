import { useMemo } from 'react';
import {
  type GlobeArc,
  type GlobeProvider,
  type GlobeRegion,
  OrthoGlobe,
} from '@/components/OrthoGlobe';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { EnvironmentSummary } from '@/lib/api/types';
import { environmentCoordinates, placeLabel } from '@/lib/geo';

const PROVIDERS: readonly string[] = ['aws', 'gcp', 'azure', 'onprem'];

function toRegion(environment: EnvironmentSummary): GlobeRegion | null {
  const point = environmentCoordinates(environment);
  if (!point) return null;
  return {
    key: environment.id,
    label: `${environment.name} · ${placeLabel(environment) ?? ''}`,
    lat: point.lat,
    lng: point.lng,
    provider: (PROVIDERS.includes(environment.kind) ? environment.kind : 'onprem') as GlobeProvider,
  };
}

/** 주 환경에서 예비 환경으로 가는 대피 항로(O02 · O03). 정면은 주 환경이고, 위치를 모르는 환경은 빠진다 */
export function SetupGlobe({
  primary,
  standbys,
  ripple = false,
}: {
  primary: EnvironmentSummary | undefined;
  standbys: EnvironmentSummary[];
  /** 주 환경에서 파문이 퍼진다(훈련 미리보기) */
  ripple?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { regions, arcs, center } = useMemo(() => {
    const all = [primary, ...standbys].flatMap((environment) =>
      environment
        ? [toRegion(environment)].filter((item): item is GlobeRegion => Boolean(item))
        : [],
    );
    const origin = all.find((region) => region.key === primary?.id);
    const routes: GlobeArc[] = origin
      ? all
          .filter((region) => region !== origin)
          .map((region) => ({ from: origin.key, to: region.key }))
      : [];
    // 기본 정면은 한국 · 일본(데모 지역)
    const front: [number, number] = origin ? [origin.lng, origin.lat - 15] : [132, 20];
    return { regions: all, arcs: routes, center: front };
  }, [primary, standbys]);

  return (
    <OrthoGlobe
      regions={regions}
      arcs={arcs}
      center={center}
      animate={!reducedMotion}
      spin={false}
      ripple={ripple ? primary?.id : undefined}
      className="aspect-square w-full max-w-110"
    />
  );
}
