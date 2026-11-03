import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo';
import type { MultiPolygon } from 'geojson';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type GlobeRegion = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  /** 점 색: 환경 종류(provider 토큰). Azure 는 provider 토큰이 없어 chart-1 을 쓴다 */
  provider: GlobeProvider;
};

export type GlobeProvider = 'aws' | 'gcp' | 'azure' | 'onprem';

/** 지도 데이터(110m)에 없는 작은 섬. 반경(°)이 화면에서 너무 작으면 최소 크기로 그린다 */
export type GlobeIsland = { key: string; lat: number; lng: number; rx: number; ry: number };

export type GlobeArc = { from: string; to: string };

type OrthoGlobeProps = {
  regions: GlobeRegion[];
  arcs: GlobeArc[];
  islands?: GlobeIsland[];
  /** 처음 정면에 올 경도·위도 */
  center: [number, number];
  /** 움직임 줄이기면 돌지 않고 곡선도 멈춘 채 다 그린다 */
  animate: boolean;
  /** false 면 곡선만 움직이고 지구본은 center 에 멈춰 둔다(온보딩: 주 환경을 정면에) */
  spin?: boolean;
  /** 이 리전에서 파문이 퍼진다(O03 훈련 미리보기) */
  ripple?: string;
  className?: string;
};

// 색은 토큰에서 읽는다(테마가 바뀌면 다음 프레임에 반영)
const TOKENS = {
  sphere: '--ep-color-globe-sphere',
  grid: '--ep-color-globe-grid',
  land: '--ep-color-globe-land',
  coast: '--ep-color-globe-coast',
  arc: '--ep-color-globe-arc',
  arcSoft: '--ep-color-globe-arc-soft',
  aws: '--ep-color-provider-aws',
  gcp: '--ep-color-provider-gcp',
  // TODO(김도영, 2026-11-03): Figma 에 provider-azure 변수가 생기면 바꾼다
  azure: '--ep-color-chart-1',
  onprem: '--ep-color-provider-onprem',
  danger: '--ep-color-status-danger-solid',
} as const;

const SPIN_DEG_PER_SECOND = 2.5;
const ARC_SECONDS = 3.2;
const TRAIL = 0.4;
const ARC_STEPS = 48;
const LIFT = 0.18;

let landCache: Promise<MultiPolygon> | undefined;

/** 세계 육지(110m, 0.1° 반올림). 한 번만 받고, 실패하면 다음에 다시 받는다 */
function loadLand(): Promise<MultiPolygon> {
  landCache ??= import('@/assets/geo/world-land-110m.json').then(
    (module) => module.default as MultiPolygon,
    (error: unknown) => {
      landCache = undefined;
      throw error;
    },
  );
  return landCache;
}

// 이 모듈(소개 · 온보딩 화면 묶음)을 불러오는 즉시 육지 데이터도 받기 시작한다.
// 화면을 다 그린 뒤 effect 에서 받으면 대륙이 약 0.4초 늦게 나타났다
loadLand().catch(() => undefined);

// 육지가 끝내 안 오면 이 시간 뒤에는 구 · 점 · 곡선만으로 보여 준다
const REVEAL_FALLBACK_MS = 1500;

function readColors() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, name]) => [key, style.getPropertyValue(name).trim()]),
  ) as Record<keyof typeof TOKENS, string>;
}

/**
 * 정사영 지구본(d3-geo + canvas). 육지는 면으로 채우고, 리전은 점, 노드 사이는 대원 경로를 따라
 * 표면 위로 떠오르는 곡선이 항로처럼 그려진다. three.js·cobe 없이 그린다
 */
export function OrthoGlobe({
  regions,
  arcs,
  islands = [],
  center,
  animate,
  spin = true,
  ripple,
  className,
}: OrthoGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    // jsdom 등 canvas 를 못 쓰면 그리지 않는다
    if (!canvas || !context) return;

    let land: MultiPolygon | undefined;
    let frame = 0;
    let stopped = false;
    // 화면 밖에 있으면 그리지 않는다. 멈춘 동안의 시간은 빼서 다시 보일 때 멈춘 자리에서 이어 돈다
    let visible = true;
    let pausedAt: number | null = null;
    let pausedTotal = 0;
    const startedAt = performance.now();
    const byKey = new Map(regions.map((region) => [region.key, region]));
    const routes = arcs.flatMap((arc) => {
      const from = byKey.get(arc.from);
      const to = byKey.get(arc.to);
      return from && to
        ? [{ interpolate: geoInterpolate([from.lng, from.lat], [to.lng, to.lat]) }]
        : [];
    });

    const projection = geoOrthographic().clipAngle(90).precision(0.5);
    const path = geoPath(projection, context);
    const graticule = geoGraticule10();

    function draw(now: number) {
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth;
      if (canvas.width !== Math.round(size * ratio)) {
        canvas.width = Math.round(size * ratio);
        canvas.height = Math.round(size * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size, size);

      const seconds = animate ? (now - startedAt - pausedTotal) / 1000 : 0;
      const lambda = -center[0] + (spin ? seconds * SPIN_DEG_PER_SECOND : 0);
      const phi = -center[1];
      const radius = size / 2 - 2;
      projection
        .translate([size / 2, size / 2])
        .scale(radius / (1 + LIFT))
        .rotate([lambda, phi]);
      const front: [number, number] = [-lambda, -phi];
      const colors = readColors();

      context.beginPath();
      path({ type: 'Sphere' });
      context.fillStyle = colors.sphere;
      context.fill();

      context.beginPath();
      path(graticule);
      context.strokeStyle = colors.grid;
      context.lineWidth = 0.6;
      context.stroke();

      if (land) {
        context.beginPath();
        path(land);
        context.fillStyle = colors.land;
        context.fill();
        context.strokeStyle = colors.coast;
        context.lineWidth = 0.6;
        context.stroke();
      }

      // 작은 섬(울릉도 · 독도 · 제주도 등). 육지와 같은 면 색, 화면에서 최소 크기 보장
      const degree = projection.scale() * (Math.PI / 180);
      for (const island of islands) {
        const point: [number, number] = [island.lng, island.lat];
        if (geoDistance(point, front) > Math.PI / 2) continue;
        const projected = projection(point);
        if (!projected) continue;
        context.beginPath();
        context.ellipse(
          projected[0],
          projected[1],
          Math.max(2.4, island.rx * degree),
          Math.max(2.4, island.ry * degree),
          0,
          0,
          Math.PI * 2,
        );
        context.fillStyle = colors.land;
        context.fill();
        context.strokeStyle = colors.coast;
        context.lineWidth = 0.6;
        context.stroke();
      }

      // 항로: 대원 경로를 따라 가운데가 표면에서 떠오른 곡선. 앞면에 있는 구간만 그린다
      const [cx, cy] = [size / 2, size / 2];
      const lifted = (point: [number, number], t: number) => {
        const projected = projection(point);
        if (!projected || geoDistance(point, front) > Math.PI / 2) return null;
        const scale = 1 + LIFT * Math.sin(Math.PI * t);
        return [cx + (projected[0] - cx) * scale, cy + (projected[1] - cy) * scale] as const;
      };
      routes.forEach((route, index) => {
        const cycle = animate ? (seconds / ARC_SECONDS + index / routes.length) % 1.4 : 1;
        const head = Math.min(1, cycle);
        const tail = animate ? Math.max(0, cycle - TRAIL) : 0;
        if (tail >= 1) return;
        context.beginPath();
        let started = false;
        for (let step = 0; step <= ARC_STEPS; step += 1) {
          const t = tail + ((head - tail) * step) / ARC_STEPS;
          const point = lifted(route.interpolate(t), t);
          if (!point) {
            started = false;
            continue;
          }
          if (started) context.lineTo(point[0], point[1]);
          else context.moveTo(point[0], point[1]);
          started = true;
        }
        context.strokeStyle = colors.arc;
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.stroke();
        const tip = head < 1 ? lifted(route.interpolate(head), head) : null;
        if (tip) {
          context.beginPath();
          context.arc(tip[0], tip[1], 3.6, 0, Math.PI * 2);
          context.fillStyle = colors.arcSoft;
          context.fill();
        }
      });

      // 리전 점: 모두 같은 크기 + 테두리, 색은 환경 종류(이름은 범례 칩이 보여 준다)
      for (const region of regions) {
        const point: [number, number] = [region.lng, region.lat];
        if (geoDistance(point, front) > Math.PI / 2 - 0.05) continue;
        const projected = projection(point);
        if (!projected) continue;
        const [x, y] = projected;
        const color = colors[region.provider];
        context.beginPath();
        context.arc(x, y, 4.2, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.beginPath();
        context.arc(x, y, 7.5, 0, Math.PI * 2);
        context.strokeStyle = color;
        context.globalAlpha = 0.35;
        context.lineWidth = 2;
        context.stroke();
        context.globalAlpha = 1;
        if (region.key === ripple) {
          // 1.6초마다 반경 8 → 28 로 번지며 옅어진다
          const phase = animate ? (seconds / 1.6) % 1 : 0.5;
          context.beginPath();
          context.arc(x, y, 8 + 20 * phase, 0, Math.PI * 2);
          context.strokeStyle = colors.danger;
          context.globalAlpha = 1 - phase;
          context.lineWidth = 2;
          context.stroke();
          context.globalAlpha = 1;
        }
      }

      if (animate && !stopped && visible) frame = requestAnimationFrame(draw);
    }

    // 소개 화면에서 아래로 내리면 지구본이 화면 밖으로 나간다(Grafana 의 보이지 않는 패널은 그리지 않기)
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            const next = entry?.isIntersecting ?? true;
            if (next === visible) return;
            visible = next;
            if (!animate || stopped) return;
            if (visible) {
              if (pausedAt !== null) pausedTotal += performance.now() - pausedAt;
              pausedAt = null;
              frame = requestAnimationFrame(draw);
            } else {
              pausedAt = performance.now();
              cancelAnimationFrame(frame);
            }
          });
    observer?.observe(canvas);

    // 육지가 준비되면 한 번에 페이드인한다(바다 · 곡선만 먼저 보였다가 대륙이 튀어나오지 않게)
    const reveal = () => {
      canvas.dataset.ready = 'true';
    };
    const fallback = window.setTimeout(reveal, REVEAL_FALLBACK_MS);
    loadLand()
      .then((loaded) => {
        land = loaded;
        if (!animate && !stopped) draw(performance.now());
      })
      .catch(() => {
        // 육지 데이터가 없어도 구·점·곡선은 그린다
      })
      .finally(reveal);
    frame = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      window.clearTimeout(fallback);
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [regions, arcs, islands, center, animate, spin, ripple]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        'opacity-0 transition-opacity duration-500 data-[ready=true]:opacity-100 motion-reduce:transition-none',
        className,
      )}
    />
  );
}
