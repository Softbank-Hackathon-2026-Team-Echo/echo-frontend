import { useEffect, useState } from 'react';

const DURATION_MS = 1200;

/** 0 에서 target 까지 센다. 시작 전·움직임 줄이기면 바로 target 을 돌려준다 */
export function useCountUp(target: number, isActive: boolean, isReducedMotion: boolean) {
  const [value, setValue] = useState(isReducedMotion ? target : 0);

  useEffect(() => {
    if (isReducedMotion) {
      setValue(target);
      return;
    }
    if (!isActive) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DURATION_MS);
      // 끝에서 천천히 멈춘다(ease-out cubic)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, isActive, isReducedMotion]);

  return value;
}
