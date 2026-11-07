import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReducedMotion } from '@/test/motion';
import { useAnimatedNumber } from './useAnimatedNumber';

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useAnimatedNumber', () => {
  it('첫 값은 즉시, 다음 값은 정수 중간값을 거쳐 약 700ms 안에 도달한다', () => {
    const { result, rerender } = renderHook(({ value }) => useAnimatedNumber(value), {
      initialProps: { value: 5 },
    });
    expect(result.current).toBe(5);
    rerender({ value: 75 });
    expect(result.current).toBe(5);
    advance(350);
    expect(result.current).toBeGreaterThan(5);
    expect(result.current).toBeLessThan(75);
    expect(Number.isInteger(result.current)).toBe(true);
    advance(370);
    expect(result.current).toBe(75);
  });

  it('중간에 롤백되면 현재 표시값부터 내려가고 이전 애니메이션을 취소한다', () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useAnimatedNumber(value), {
      initialProps: { value: 0 },
    });
    rerender({ value: 100 });
    advance(160);
    const middle = result.current;
    rerender({ value: 0 });
    expect(result.current).toBe(middle);
    advance(160);
    expect(result.current).toBeLessThan(middle);
    expect(result.current).toBeGreaterThan(0);
    advance(560);
    expect(result.current).toBe(0);
    rerender({ value: 50 });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('움직임 줄이기면 타이머 없이 즉시 반영하고 실행 중 켜도 멈춘다', () => {
    const setReduced = mockReducedMotion(true);
    const { result, rerender } = renderHook(({ value }) => useAnimatedNumber(value), {
      initialProps: { value: 0 },
    });
    rerender({ value: 50 });
    expect(result.current).toBe(50);
    expect(vi.getTimerCount()).toBe(0);
    act(() => setReduced(false));
    rerender({ value: 100 });
    advance(160);
    expect(result.current).toBeLessThan(100);
    act(() => setReduced(true));
    expect(result.current).toBe(100);
    expect(vi.getTimerCount()).toBe(0);
  });
});
