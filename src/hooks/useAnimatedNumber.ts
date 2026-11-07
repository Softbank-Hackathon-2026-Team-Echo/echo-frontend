import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const DURATION_MS = 700;

/** 표시용 숫자만 보간한다. 서버 판정·그래프에는 이 값을 쓰지 않는다. */
export function useAnimatedNumber(value: number) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (reducedMotion) {
      current.current = value;
      setDisplayed(value);
      return;
    }
    const from = current.current;
    if (from === value) return;
    const started = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / DURATION_MS);
      const next = from + (value - from) * (1 - (1 - progress) ** 3);
      current.current = next;
      setDisplayed(Math.round(next));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);

  return reducedMotion ? value : displayed;
}
