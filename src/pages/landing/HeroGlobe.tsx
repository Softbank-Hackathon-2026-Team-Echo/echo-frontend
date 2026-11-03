import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { readTokenRgb } from './globe-colors';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// 시연 환경 3곳 (위도, 경도)
const TOKYO: [number, number] = [35.68, 139.69];
const SEOUL: [number, number] = [37.57, 126.98];
const FUKUOKA: [number, number] = [33.59, 130.4];

// 동아시아가 정면에 오는 각도. cobe 는 경도 0 이 phi = -π/2 다
const START_PHI = Math.PI - ((133 * Math.PI) / 180 - Math.PI / 2);
// 지구본 아래쪽은 대시보드 그림이 덮으므로 북위 35° 근처(시연 3곳)가 윗부분에 오게 기울인다
const THETA = -0.25;
const SPIN_PER_FRAME = 0.0025;

/** 히어로 지구본(cobe). 항상 천천히 돈다. 움직임 줄이기면 동아시아에서 멈춘다 */
export function HeroGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    // jsdom·WebGL 이 없는 브라우저에서는 그리지 않는다(바탕 원만 남는다)
    if (!canvas || typeof WebGLRenderingContext === 'undefined') return;

    let destroyed = false;
    let globe: { destroy: () => void } | undefined;
    let phi = START_PHI;

    import('cobe').then(({ default: createGlobe }) => {
      if (destroyed) return;
      const size = canvas.offsetWidth;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: pixelRatio,
          width: size * pixelRatio,
          height: size * pixelRatio,
          phi,
          theta: THETA,
          dark: theme === 'dark' ? 1 : 0,
          diffuse: 1.1,
          mapSamples: 16_000,
          // 밝은 테마는 바다가 baseColor, 육지 점이 그보다 어둡다. 밝기를 낮춰 점을 옅은 남색으로 둔다
          mapBrightness: theme === 'dark' ? 6 : 0.7,
          mapBaseBrightness: 0,
          baseColor: readTokenRgb('--ep-color-globe-land'),
          markerColor: readTokenRgb('--ep-color-globe-arc'),
          glowColor: readTokenRgb('--ep-color-globe-sphere'),
          markers: [
            { location: TOKYO, size: 0.07, color: readTokenRgb('--ep-color-status-danger-solid') },
            {
              location: SEOUL,
              size: 0.07,
              color: readTokenRgb('--ep-color-status-migrating-solid'),
            },
            {
              location: FUKUOKA,
              size: 0.06,
              color: readTokenRgb('--ep-color-status-success-solid'),
            },
          ],
          onRender: (state) => {
            if (!isReducedMotion) phi += SPIN_PER_FRAME;
            state.phi = phi;
            state.width = canvas.offsetWidth * pixelRatio;
            state.height = canvas.offsetWidth * pixelRatio;
          },
        });
      } catch {
        // WebGL 컨텍스트를 못 얻으면 지구본 없이 둔다
      }
    });

    return () => {
      destroyed = true;
      globe?.destroy();
    };
  }, [theme, isReducedMotion]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
