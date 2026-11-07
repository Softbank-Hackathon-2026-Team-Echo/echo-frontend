import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Disaster } from '@/lib/api/disasters';
import { ARRIVAL_MAX_AGE_MS, pickArrival, useDisasterArrival } from './useDisasterArrival';

const NOW = Date.parse('2026-11-08T05:00:00Z');

function disaster(id: string, startedAt = new Date(NOW).toISOString()) {
  return { id, startedAt } as Disaster;
}

describe('pickArrival', () => {
  it('처음 보는 재난 중 마지막 것을 고르고 본 것으로 기억한다', () => {
    const seen = new Set(['a']);
    expect(pickArrival(seen, [disaster('a'), disaster('b'), disaster('c')], NOW)?.id).toBe('c');
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
    expect(pickArrival(seen, [disaster('a'), disaster('b'), disaster('c')], NOW)).toBeNull();
  });

  it('오래전에 시작한 재난은 연출하지 않는다', () => {
    const old = new Date(NOW - ARRIVAL_MAX_AGE_MS - 1).toISOString();
    const seen = new Set<string>();
    expect(pickArrival(seen, [disaster('old', old)], NOW)).toBeNull();
    expect(seen.has('old')).toBe(true);
  });
});

describe('useDisasterArrival', () => {
  it('화면을 열 때 이미 있던 재난은 흔들지 않고, 그 뒤 들어온 재난만 알린다', () => {
    const { result, rerender } = renderHook(({ items }) => useDisasterArrival(items), {
      initialProps: { items: undefined as Disaster[] | undefined },
    });
    rerender({ items: [disaster('before', new Date().toISOString())] });
    expect(result.current.arrival).toBeNull();

    rerender({
      items: [
        disaster('before', new Date().toISOString()),
        disaster('new', new Date().toISOString()),
      ],
    });
    expect(result.current.arrival?.id).toBe('new');

    act(() => result.current.dismiss());
    expect(result.current.arrival).toBeNull();
  });
});
