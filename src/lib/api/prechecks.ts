// 시뮬레이션: AI 사전 점검 API(계약 4-5 🆕, AI 에이전트 파트)가 생기기 전까지 브라우저 안에서 흉내 낸다.
// 모양은 계약 초안(steps · featureGaps · configDiff · patches · blockedAttempts)과 같고 항상 simulated 다.
// 데모 증거(F14~F16): 샌드박스 id · 검증 실패 1건 차단 + 통과 1건은 사람 승인 · 운영 변경 시도 1건 거부
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

export const PRECHECK_API_READY = false;

export type PrecheckStepName =
  | 'SANDBOX'
  | 'CONFIG_DIFF'
  | 'FEATURE_GAPS'
  | 'PATCH_VERIFY'
  | 'APPROVAL';
export type PrecheckStepState = 'DONE' | 'RUNNING' | 'PENDING';
export type PatchStatus = 'VERIFYING' | 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'BLOCKED';

export type DiffLine = { line: number; kind: 'context' | 'added' | 'removed'; text: string };

export type Patch = {
  id: string;
  number: number;
  file: string;
  reason: string;
  diff: DiffLine[];
  verification: { passed: number; total: number };
  status: PatchStatus;
};

export type FeatureGap = { source: string; target: string; gap: string; action: string };
export type ConfigChange = { key: string; source: string; target: string };
export type BlockedAttempt = { action: string; target: string; at: string; reason: string };

export type Precheck = {
  id: string;
  serviceId: string;
  targetEnvironmentId: string;
  sandboxId: string;
  startedAt: string;
  stoppedAt: string | null;
  /** 사람이 승인·거절한 패치 결정 (patchId → 상태) */
  decisions: Record<string, 'APPROVED' | 'REJECTED'>;
  simulated: true;
};

export type PrecheckView = Precheck & {
  steps: { name: PrecheckStepName; state: PrecheckStepState; at: string | null }[];
  configDiff: ConfigChange[];
  featureGaps: FeatureGap[];
  patches: Patch[];
  blockedAttempts: BlockedAttempt[];
  logs: { at: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string }[];
  /** 승인 대기 패치가 없고 검증이 끝났으면 다음(계획 승인)으로 간다 */
  ready: boolean;
};

// 단계가 끝나는 시각(시작 뒤 초). 데모에서 지켜보기 좋게 짧게 둔다
const AT = {
  SANDBOX: 1,
  CONFIG_DIFF: 3,
  FEATURE_GAPS: 5,
  BLOCKED: 6,
  VERIFY_FAIL: 8,
  VERIFY_PASS: 10,
};

type Scenario = {
  configDiff: ConfigChange[];
  featureGaps: FeatureGap[];
  patches: Omit<Patch, 'status'>[];
};

const CLOUD_SCENARIO: Scenario = {
  configDiff: [
    { key: 'DB_MAX_CONNECTIONS', source: '200', target: '100' },
    { key: 'SECRET_STORE', source: 'aws-sm', target: 'gcp-sm' },
    { key: 'LOG_SINK', source: 'cloudwatch', target: 'cloud-logging' },
  ],
  featureGaps: [
    {
      source: 'RDS max_connections 200',
      target: 'Cloud SQL default 100',
      gap: 'capacity',
      action: 'patch #3',
    },
    { source: 'Secrets Manager', target: 'Secret Manager', gap: 'name format', action: 'mapped' },
    { source: 'CloudWatch alarms', target: 'Cloud Monitoring', gap: 'no alarm', action: 'manual' },
  ],
  patches: [
    {
      id: 'patch-2',
      number: 2,
      file: 'k8s/hpa.yaml',
      reason:
        'Feature gap: scale-out signal differs on the target. The proposed HPA rule failed load tests.',
      diff: [
        { line: 12, kind: 'context', text: 'minReplicas: 2' },
        { line: 13, kind: 'removed', text: 'targetCPUUtilizationPercentage: 70' },
        { line: 13, kind: 'added', text: 'targetCPUUtilizationPercentage: 95' },
      ],
      verification: { passed: 9, total: 12 },
    },
    {
      id: 'patch-3',
      number: 3,
      file: 'postgresql.conf',
      reason:
        'Feature gap: connection limit on the target database is lower than the source. Raising it keeps peak traffic within capacity.',
      diff: [
        { line: 41, kind: 'context', text: 'shared_buffers = 4GB' },
        { line: 42, kind: 'removed', text: 'max_connections = 100' },
        { line: 42, kind: 'added', text: 'max_connections = 200' },
        { line: 43, kind: 'context', text: 'work_mem = 16MB' },
      ],
      verification: { passed: 12, total: 12 },
    },
  ],
};

function patchStatus(
  patch: Omit<Patch, 'status'>,
  precheck: Precheck,
  elapsed: number,
): PatchStatus {
  const decided = precheck.decisions[patch.id];
  if (decided) return decided;
  const failed = patch.verification.passed < patch.verification.total;
  if (elapsed < (failed ? AT.VERIFY_FAIL : AT.VERIFY_PASS)) return 'VERIFYING';
  // 검증에 실패한 패치는 사람에게 묻지 않고 막는다 (F15)
  return failed ? 'BLOCKED' : 'PROPOSED';
}

/** 시작 시각에서 흐른 시간으로 단계·패치 상태를 만든다 */
export function viewPrecheck(
  precheck: Precheck,
  sourceName: string,
  now = Date.now(),
): PrecheckView {
  const started = new Date(precheck.startedAt).getTime();
  const end = precheck.stoppedAt ? new Date(precheck.stoppedAt).getTime() : now;
  const elapsed = (end - started) / 1000;
  const at = (seconds: number) => new Date(started + seconds * 1000).toISOString();
  const reached = (seconds: number) => elapsed >= seconds;

  const scenario = CLOUD_SCENARIO;
  const patches = scenario.patches.map((patch) => ({
    ...patch,
    status: patchStatus(patch, precheck, elapsed),
  }));
  const verified = reached(AT.VERIFY_PASS);
  const waiting = patches.some(
    (patch) => patch.status === 'PROPOSED' || patch.status === 'VERIFYING',
  );

  const stepAt = (
    seconds: number,
    running: boolean,
  ): { state: PrecheckStepState; at: string | null } =>
    reached(seconds)
      ? { state: 'DONE', at: at(seconds) }
      : { state: running ? 'RUNNING' : 'PENDING', at: null };

  const steps: PrecheckView['steps'] = [
    { name: 'SANDBOX', ...stepAt(AT.SANDBOX, true) },
    { name: 'CONFIG_DIFF', ...stepAt(AT.CONFIG_DIFF, reached(AT.SANDBOX)) },
    { name: 'FEATURE_GAPS', ...stepAt(AT.FEATURE_GAPS, reached(AT.CONFIG_DIFF)) },
    { name: 'PATCH_VERIFY', ...stepAt(AT.VERIFY_PASS, reached(AT.FEATURE_GAPS)) },
    {
      name: 'APPROVAL',
      state: verified && !waiting ? 'DONE' : verified ? 'RUNNING' : 'PENDING',
      at: null,
    },
  ];

  const blockedAttempts: BlockedAttempt[] = reached(AT.BLOCKED)
    ? [
        {
          action: 'kubectl apply -f k8s/hpa.yaml',
          target: sourceName,
          at: at(AT.BLOCKED),
          reason: 'Agent role allows sandbox write + production read only.',
        },
      ]
    : [];

  const logs: PrecheckView['logs'] = [
    { seconds: 0, level: 'INFO', message: `sandbox ${precheck.sandboxId} requested` },
    { seconds: AT.SANDBOX, level: 'INFO', message: 'sandbox ready · image copied from source' },
    {
      seconds: AT.CONFIG_DIFF,
      level: 'INFO',
      message: `${scenario.configDiff.length} config keys differ`,
    },
    {
      seconds: AT.FEATURE_GAPS,
      level: 'INFO',
      message: `${scenario.featureGaps.length} feature gaps mapped`,
    },
    {
      seconds: AT.BLOCKED,
      level: 'ERROR',
      message: `blocked: agent tried to change production (${sourceName})`,
    },
    {
      seconds: AT.VERIFY_FAIL,
      level: 'WARN',
      message: 'patch #2 failed verification (9/12) · blocked',
    },
    {
      seconds: AT.VERIFY_PASS,
      level: 'INFO',
      message: 'patch #3 passed verification (12/12) · waiting for approval',
    },
  ]
    .filter((line) => reached(line.seconds))
    .map((line) => ({
      at: at(line.seconds),
      level: line.level as 'INFO' | 'WARN' | 'ERROR',
      message: line.message,
    }));

  return {
    ...precheck,
    steps,
    configDiff: reached(AT.CONFIG_DIFF) ? scenario.configDiff : [],
    featureGaps: reached(AT.FEATURE_GAPS) ? scenario.featureGaps : [],
    patches: reached(AT.FEATURE_GAPS) ? patches : [],
    blockedAttempts,
    logs,
    ready: verified && !waiting && !precheck.stoppedAt,
  };
}

// 탭 단위 저장(새로고침해도 유지). 서비스 · 도착 환경 한 쌍에 점검 하나
function storageKey(orgId: string) {
  return `echoport.prechecks.${orgId}`;
}

function load(orgId: string): Precheck[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(orgId));
    if (raw) return JSON.parse(raw) as Precheck[];
  } catch {
    // 저장소를 못 읽으면 새로 시작한다
  }
  return [];
}

function save(orgId: string, prechecks: Precheck[]) {
  try {
    window.sessionStorage.setItem(storageKey(orgId), JSON.stringify(prechecks));
  } catch {
    // 저장하지 못해도 이번 화면에서는 동작한다
  }
}

function findPrecheck(orgId: string, serviceId: string, targetEnvironmentId: string) {
  return load(orgId).find(
    (item) => item.serviceId === serviceId && item.targetEnvironmentId === targetEnvironmentId,
  );
}

/** 이 서비스·도착 환경의 점검. 없으면 null(아직 시작 안 함). 진행 중에는 1초마다 다시 계산한다 */
export function usePrecheck(
  orgId: string | undefined,
  serviceId: string | undefined,
  targetId: string | undefined,
) {
  return useQuery({
    queryKey: [...queryKeys.prechecks(orgId ?? ''), serviceId ?? '', targetId ?? ''],
    queryFn: async () => findPrecheck(orgId ?? '', serviceId ?? '', targetId ?? '') ?? null,
    enabled: Boolean(orgId && serviceId && targetId),
    refetchInterval: 1_000,
  });
}

function useWritePrecheck(orgId: string) {
  const queryClient = useQueryClient();
  return (update: (all: Precheck[]) => Precheck[]) => {
    save(orgId, update(load(orgId)));
    return queryClient.invalidateQueries({ queryKey: queryKeys.prechecks(orgId) });
  };
}

export function useStartPrecheck(orgId: string) {
  const write = useWritePrecheck(orgId);
  return useMutation({
    mutationFn: async ({
      serviceId,
      targetEnvironmentId,
    }: {
      serviceId: string;
      targetEnvironmentId: string;
    }) => {
      const precheck: Precheck = {
        id: crypto.randomUUID(),
        serviceId,
        targetEnvironmentId,
        sandboxId: `sbx-${crypto.randomUUID().slice(0, 4)}`,
        startedAt: new Date().toISOString(),
        stoppedAt: null,
        decisions: {},
        simulated: true,
      };
      await write((all) => [
        ...all.filter(
          (item) =>
            !(item.serviceId === serviceId && item.targetEnvironmentId === targetEnvironmentId),
        ),
        precheck,
      ]);
      return precheck;
    },
  });
}

export function useStopPrecheck(orgId: string) {
  const write = useWritePrecheck(orgId);
  return useMutation({
    mutationFn: (precheckId: string) =>
      write((all) =>
        all.map((item) =>
          item.id === precheckId ? { ...item, stoppedAt: new Date().toISOString() } : item,
        ),
      ),
  });
}

export function useDecidePatch(orgId: string) {
  const write = useWritePrecheck(orgId);
  return useMutation({
    mutationFn: ({
      precheckId,
      patchId,
      decision,
    }: {
      precheckId: string;
      patchId: string;
      decision: 'APPROVED' | 'REJECTED';
    }) =>
      write((all) =>
        all.map((item) =>
          item.id === precheckId
            ? { ...item, decisions: { ...item.decisions, [patchId]: decision } }
            : item,
        ),
      ),
  });
}
