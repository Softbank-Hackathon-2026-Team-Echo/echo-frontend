// 시연용 충격 트리거(R2b). 휴대폰을 흔들거나 떨어뜨리면 DeviceMotion 가속도가 튀는 것을 잡는다.
// 화면·센서와 떨어진 순수 함수만 둬서 단위 시험으로 판정 규칙을 고정한다

/** 기본 임계(m/s²). 중력 포함 가속도라 가만히 있으면 약 9.8, 세게 흔들거나 바닥에 닿으면 25를 넘는다 */
export const DEFAULT_SHAKE_THRESHOLD = 25;
export const MIN_SHAKE_THRESHOLD = 12;
export const MAX_SHAKE_THRESHOLD = 60;

/** 한 번 보낸 뒤 이 시간 동안은 다시 보내지 않는다(떨어진 휴대폰이 튕기며 여러 번 튀는 것을 막는다) */
export const SHAKE_LOCK_MS = 10_000;

export type Vector3 = { x: number | null; y: number | null; z: number | null };

/** 세 축 가속도의 크기. 축 값이 없으면 0으로 본다 */
export function accelerationMagnitude(vector: Vector3 | null | undefined): number {
  if (!vector) return 0;
  const x = vector.x ?? 0;
  const y = vector.y ?? 0;
  const z = vector.z ?? 0;
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * DeviceMotionEvent 에서 판정에 쓸 가속도 크기. 중력 포함 값을 먼저 쓰고,
 * 기기가 그 값을 주지 않으면 중력 뺀 값에 중력(9.81)을 더해 같은 눈금으로 맞춘다
 */
export function motionMagnitude(event: {
  accelerationIncludingGravity?: Vector3 | null;
  acceleration?: Vector3 | null;
}): number {
  const withGravity = event.accelerationIncludingGravity;
  if (withGravity && (withGravity.x !== null || withGravity.y !== null || withGravity.z !== null)) {
    return accelerationMagnitude(withGravity);
  }
  const linear = accelerationMagnitude(event.acceleration);
  return linear > 0 ? linear + 9.81 : 0;
}

export function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SHAKE_THRESHOLD;
  return Math.min(MAX_SHAKE_THRESHOLD, Math.max(MIN_SHAKE_THRESHOLD, value));
}

export type ShakeGate = {
  /** 감지가 켜져 있나(사람이 감지 시작을 눌렀나) */
  armed: boolean;
  /** 진행 중(ACTIVE) 재난이 있거나 요청을 보내는 중이면 막는다 */
  blocked: boolean;
  /** 마지막으로 보낸 시각(ms). 없으면 null */
  lastTriggeredAt: number | null;
  now: number;
  lockMs?: number;
};

/** 잠금이 풀리기까지 남은 시간(ms). 잠겨 있지 않으면 0 */
export function lockRemainingMs({
  lastTriggeredAt,
  now,
  lockMs = SHAKE_LOCK_MS,
}: Pick<ShakeGate, 'lastTriggeredAt' | 'now' | 'lockMs'>): number {
  if (lastTriggeredAt === null) return 0;
  return Math.max(0, lastTriggeredAt + lockMs - now);
}

/** 이 가속도 크기로 재난 선언을 보내야 하나. 임계를 넘고, 켜져 있고, 막히지 않고, 잠금이 풀렸을 때만 참 */
export function shouldTrigger(magnitude: number, threshold: number, gate: ShakeGate): boolean {
  if (!gate.armed || gate.blocked) return false;
  if (lockRemainingMs(gate) > 0) return false;
  return magnitude > clampThreshold(threshold);
}

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** 이 브라우저의 DeviceMotionEvent. 센서 API 가 아예 없으면 undefined */
export function motionEventClass(): unknown {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
    ? window.DeviceMotionEvent
    : undefined;
}

/** iOS 13+ 는 사람이 누른 버튼 안에서 requestPermission() 을 불러야 센서 값을 준다 */
export function needsMotionPermission(ctor: unknown): boolean {
  return typeof (ctor as PermissionRequester | undefined)?.requestPermission === 'function';
}

export type MotionSupport = 'granted' | 'denied' | 'unsupported';

/** 센서 권한을 받는다. 권한 절차가 없는 브라우저(안드로이드 크롬 등)는 바로 granted */
export async function requestMotionPermission(ctor: unknown): Promise<MotionSupport> {
  if (ctor === undefined) return 'unsupported';
  const requester = ctor as PermissionRequester;
  if (typeof requester.requestPermission !== 'function') return 'granted';
  try {
    return (await requester.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
