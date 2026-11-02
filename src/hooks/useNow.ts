import { useEffect, useState } from 'react';

/** 진행 중인 경과 시간을 그리려고 지금 시각을 주기적으로 갱신한다. active 가 false 면 멈춘다 */
export function useNow(active: boolean, intervalMs = 1_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}
