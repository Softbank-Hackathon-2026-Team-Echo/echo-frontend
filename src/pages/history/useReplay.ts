import { useEffect, useState } from 'react';

// 기록 시각과 무관한 화면 속도다. 재생은 화면에서 고른 단계만 바꾼다
export const REPLAY_STEP_MS = 1_200;

export function useReplay(stepCount: number) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastIndex = Math.max(0, stepCount - 1);

  useEffect(() => {
    if (!isPlaying) return;
    if (index >= lastIndex) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex(index + 1), REPLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, isPlaying, lastIndex]);

  function seek(next: number) {
    setIsPlaying(false);
    setIndex(Math.min(lastIndex, Math.max(0, next)));
  }

  function togglePlay() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (index >= lastIndex) setIndex(0);
    setIsPlaying(true);
  }

  return { index, isPlaying, lastIndex, seek, togglePlay };
}
