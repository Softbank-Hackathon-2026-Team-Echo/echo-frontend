import { describe, expect, it } from 'vitest';
import {
  accelerationMagnitude,
  clampThreshold,
  DEFAULT_SHAKE_THRESHOLD,
  lockRemainingMs,
  MAX_SHAKE_THRESHOLD,
  MIN_SHAKE_THRESHOLD,
  motionMagnitude,
  needsMotionPermission,
  requestMotionPermission,
  SHAKE_LOCK_MS,
  shouldTrigger,
} from './shake';

// 권한 절차가 없는 브라우저(안드로이드 크롬 등)의 DeviceMotionEvent 대신
const noPermissionStep = {};

const open = { armed: true, blocked: false, lastTriggeredAt: null, now: 100_000 };

describe('accelerationMagnitude', () => {
  it('세 축의 크기를 낸다', () => {
    expect(accelerationMagnitude({ x: 3, y: 4, z: 12 })).toBe(13);
  });

  it('빠진 축은 0으로 본다', () => {
    expect(accelerationMagnitude({ x: null, y: 6, z: 8 })).toBe(10);
    expect(accelerationMagnitude(null)).toBe(0);
  });
});

describe('motionMagnitude', () => {
  it('중력 포함 값을 먼저 쓴다', () => {
    expect(
      motionMagnitude({
        accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
        acceleration: { x: 30, y: 0, z: 0 },
      }),
    ).toBeCloseTo(9.81);
  });

  it('중력 포함 값이 없으면 중력 뺀 값에 9.81을 더한다', () => {
    expect(
      motionMagnitude({
        accelerationIncludingGravity: { x: null, y: null, z: null },
        acceleration: { x: 20, y: 0, z: 0 },
      }),
    ).toBeCloseTo(29.81);
  });

  it('둘 다 없으면 0', () => {
    expect(motionMagnitude({})).toBe(0);
  });
});

describe('shouldTrigger', () => {
  it('가만히 놓인 휴대폰(약 9.8)은 기본 임계 25를 넘지 않는다', () => {
    expect(shouldTrigger(9.81, DEFAULT_SHAKE_THRESHOLD, open)).toBe(false);
  });

  it('임계를 넘으면 보낸다. 임계와 같으면 보내지 않는다', () => {
    expect(shouldTrigger(25.1, 25, open)).toBe(true);
    expect(shouldTrigger(25, 25, open)).toBe(false);
  });

  it('감지를 켜지 않았거나 진행 중 재난이 있으면 보내지 않는다', () => {
    expect(shouldTrigger(80, 25, { ...open, armed: false })).toBe(false);
    expect(shouldTrigger(80, 25, { ...open, blocked: true })).toBe(false);
  });

  it('보낸 뒤 10초 동안은 다시 보내지 않는다', () => {
    const sentAt = open.now;
    expect(shouldTrigger(80, 25, { ...open, lastTriggeredAt: sentAt, now: sentAt + 1 })).toBe(
      false,
    );
    expect(
      shouldTrigger(80, 25, {
        ...open,
        lastTriggeredAt: sentAt,
        now: sentAt + SHAKE_LOCK_MS - 1,
      }),
    ).toBe(false);
    expect(
      shouldTrigger(80, 25, { ...open, lastTriggeredAt: sentAt, now: sentAt + SHAKE_LOCK_MS }),
    ).toBe(true);
  });

  it('임계는 화면 범위 안으로 자른다', () => {
    // 1 은 최소 12 로 올라간다
    expect(shouldTrigger(MIN_SHAKE_THRESHOLD + 1, 1, open)).toBe(true);
    expect(shouldTrigger(MIN_SHAKE_THRESHOLD - 1, 1, open)).toBe(false);
    // 500 은 최대 60 으로 내려간다
    expect(shouldTrigger(MAX_SHAKE_THRESHOLD + 1, 500, open)).toBe(true);
  });
});

describe('lockRemainingMs', () => {
  it('보낸 적이 없으면 0, 있으면 남은 시간', () => {
    expect(lockRemainingMs({ lastTriggeredAt: null, now: 5 })).toBe(0);
    expect(lockRemainingMs({ lastTriggeredAt: 1_000, now: 4_000 })).toBe(SHAKE_LOCK_MS - 3_000);
    expect(lockRemainingMs({ lastTriggeredAt: 1_000, now: 1_000 + SHAKE_LOCK_MS + 5 })).toBe(0);
  });
});

describe('clampThreshold', () => {
  it('범위 밖·숫자 아님을 바로잡는다', () => {
    expect(clampThreshold(5)).toBe(MIN_SHAKE_THRESHOLD);
    expect(clampThreshold(500)).toBe(MAX_SHAKE_THRESHOLD);
    expect(clampThreshold(Number.NaN)).toBe(DEFAULT_SHAKE_THRESHOLD);
    expect(clampThreshold(30)).toBe(30);
  });
});

describe('센서 권한', () => {
  it('requestPermission 이 있으면(iOS) 권한 절차가 필요하다', () => {
    expect(needsMotionPermission({ requestPermission: async () => 'granted' })).toBe(true);
    expect(needsMotionPermission(noPermissionStep)).toBe(false);
    expect(needsMotionPermission(undefined)).toBe(false);
  });

  it('iOS 권한 결과를 그대로 돌려준다', async () => {
    await expect(
      requestMotionPermission({ requestPermission: async () => 'granted' }),
    ).resolves.toBe('granted');
    await expect(
      requestMotionPermission({ requestPermission: async () => 'denied' }),
    ).resolves.toBe('denied');
    await expect(
      requestMotionPermission({
        requestPermission: async () => {
          throw new Error('not from a user gesture');
        },
      }),
    ).resolves.toBe('denied');
  });

  it('권한 절차가 없으면 granted, 센서가 아예 없으면 unsupported', async () => {
    await expect(requestMotionPermission(noPermissionStep)).resolves.toBe('granted');
    await expect(requestMotionPermission(undefined)).resolves.toBe('unsupported');
  });
});
