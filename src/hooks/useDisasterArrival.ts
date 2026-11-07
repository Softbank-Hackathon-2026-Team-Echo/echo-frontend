import { useCallback, useEffect, useRef, useState } from 'react';
import type { Disaster } from '@/lib/api/disasters';

/** 이보다 오래전에 시작한 재난은 "방금 생긴" 재난으로 보지 않는다(서버·브라우저 시계 차이 여유 포함) */
export const ARRIVAL_MAX_AGE_MS = 2 * 60_000;

/**
 * 처음 본 재난 중 가장 최근 것을 고른다. 순수 함수라 훅과 테스트가 같이 쓴다.
 * - `seen` 에 없는 재난만 새 재난이다(고른 뒤 `seen` 에 넣는다)
 * - 시작한 지 `ARRIVAL_MAX_AGE_MS` 가 지난 재난은 넣기만 하고 고르지 않는다
 */
export function pickArrival(
  seen: Set<string>,
  disasters: Disaster[],
  now: number,
): Disaster | null {
  const fresh = disasters.filter((item) => !seen.has(item.id));
  for (const item of fresh) seen.add(item.id);
  const latest = fresh.at(-1);
  if (!latest) return null;
  const startedAt = Date.parse(latest.startedAt);
  if (Number.isFinite(startedAt) && now - startedAt > ARRIVAL_MAX_AGE_MS) return null;
  return latest;
}

/**
 * 폴링 중에 새 재난이 들어온 순간을 알려 준다(화면 흔들림 · 진원지 파동 연출용).
 * 화면을 처음 열 때 이미 진행 중이던 재난은 새 재난이 아니다. 새로고침해도 다시 흔들리지 않는다
 */
export function useDisasterArrival(disasters: Disaster[] | undefined) {
  const seen = useRef<Set<string> | null>(null);
  const [arrival, setArrival] = useState<Disaster | null>(null);

  useEffect(() => {
    if (!disasters) return;
    if (seen.current === null) {
      seen.current = new Set(disasters.map((item) => item.id));
      return;
    }
    const next = pickArrival(seen.current, disasters, Date.now());
    if (next) setArrival(next);
  }, [disasters]);

  const dismiss = useCallback(() => setArrival(null), []);
  return { arrival, dismiss };
}
