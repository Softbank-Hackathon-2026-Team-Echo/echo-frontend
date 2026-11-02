// MOCK: 프론트 목업 데이터. 모양은 echo-was app/schemas · docs/api/*.md 와 같다. 실제 토큰·비밀값은 넣지 않는다
import type {
  DeployRequestDetail,
  EnvironmentDetail,
  EnvironmentKind,
  EnvironmentSummary,
  Me,
  Organization,
  ServiceDetail,
} from '@/lib/api/types';

const CREATED_AT = '2026-11-02T00:00:00Z';

export const mockOrganizations: Organization[] = [
  {
    id: '0b6f2c3e-1d2a-4c55-9e1a-6f0e5c7a1001',
    slug: 'echoport',
    name: 'echoport',
    personal: true,
    role: 'ADMIN',
    createdAt: CREATED_AT,
  },
  {
    id: '0b6f2c3e-1d2a-4c55-9e1a-6f0e5c7a1002',
    slug: 'echo-demo',
    name: 'Echo Demo',
    personal: false,
    role: 'DEVELOPER',
    createdAt: CREATED_AT,
  },
  {
    // 뷰어로 들어온 데모 조직. 권한이 모자라 버튼이 막히는 장면(F4)을 보여 준다
    id: '0b6f2c3e-1d2a-4c55-9e1a-6f0e5c7a1003',
    slug: 'echo-viewer',
    name: 'Echo Viewer (demo)',
    personal: false,
    role: 'VIEWER',
    createdAt: CREATED_AT,
  },
];

export const mockMe: Me = {
  user: {
    id: '7d1e4a90-55b3-4f0e-8c2d-2a9b6e3f2001',
    githubLogin: 'echoport',
    name: 'EchoPort Demo',
    avatarUrl: null,
  },
  organizations: mockOrganizations,
};

export const mockEnvironmentKinds: EnvironmentKind[] = [
  {
    kind: 'aws',
    configSchema: {
      type: 'object',
      properties: {
        region: {
          type: 'string',
          enum: ['ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'us-east-1', 'us-west-2'],
        },
        clusterName: { type: 'string', minLength: 1 },
      },
      required: ['region', 'clusterName'],
    },
  },
  {
    kind: 'gcp',
    configSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', examples: ['echo-hack-123'] },
        region: {
          type: 'string',
          enum: ['asia-northeast1', 'asia-northeast2', 'asia-northeast3'],
        },
        clusterName: { type: 'string', minLength: 1 },
      },
      required: ['projectId', 'region', 'clusterName'],
    },
  },
  {
    kind: 'onprem',
    configSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', examples: ['fukuoka'] },
        kubeContext: { type: 'string', examples: ['k3s-fukuoka'] },
      },
      required: ['location', 'kubeContext'],
    },
  },
];

export function makeEnvironment(
  partial: Pick<EnvironmentSummary, 'id' | 'name' | 'kind' | 'location' | 'config'> &
    Partial<EnvironmentSummary>,
): EnvironmentSummary {
  return {
    secretRef: null,
    connectionStatus: 'UNCHECKED',
    connectionCheckedAt: null,
    connectionError: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...partial,
  };
}

const ENV_TOKYO = '3c0f8e21-9a4b-4d6e-b1c2-5e7f9a0b3001';
const ENV_SEOUL = '3c0f8e21-9a4b-4d6e-b1c2-5e7f9a0b3002';
const ENV_FUKUOKA = '3c0f8e21-9a4b-4d6e-b1c2-5e7f9a0b3003';

export const mockEnvironments: EnvironmentSummary[] = [
  makeEnvironment({
    id: ENV_TOKYO,
    name: 'aws-tokyo-prod',
    kind: 'aws',
    location: 'ap-northeast-1',
    config: { region: 'ap-northeast-1', clusterName: 'echo-prod' },
    secretRef: 'env:ECHO_SECRET_ECHOPORT__AWS_TOKYO',
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: '2026-11-02T06:00:00Z',
  }),
  makeEnvironment({
    id: ENV_SEOUL,
    name: 'gcp-seoul-standby',
    kind: 'gcp',
    location: 'asia-northeast3',
    config: { projectId: 'echo-hack-123', region: 'asia-northeast3', clusterName: 'echo-standby' },
    secretRef: 'env:ECHO_SECRET_ECHOPORT__GCP_SEOUL',
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: '2026-11-02T06:00:00Z',
  }),
  makeEnvironment({
    id: ENV_FUKUOKA,
    name: 'onprem-fukuoka',
    kind: 'onprem',
    location: 'fukuoka',
    config: { location: 'fukuoka', kubeContext: 'k3s-fukuoka' },
    secretRef: 'env:ECHO_SECRET_ECHOPORT__ONPREM_FUKUOKA',
  }),
];

const CLUSTER_INFO: Record<string, EnvironmentDetail['clusterInfo']> = {
  aws: { serverVersion: 'v1.31.0', nodeCount: 3, simulated: true },
  gcp: { serverVersion: 'v1.31.0', nodeCount: 2, simulated: true },
  onprem: { serverVersion: 'v1.30.4+k3s1', nodeCount: 1, simulated: true },
};

export function mockEnvironmentDetail(environment: EnvironmentSummary): EnvironmentDetail {
  // 접속 확인이 실패한 환경은 클러스터 정보를 읽지 못한다 (echo-was 와 같은 모양)
  if (environment.connectionStatus === 'FAILED') {
    return { ...environment, clusterInfo: null, clusterInfoError: environment.connectionError };
  }
  return {
    ...environment,
    clusterInfo: CLUSTER_INFO[environment.kind] ?? null,
    clusterInfoError: null,
  };
}

export const SHA_V1 = '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432';
export const SHA_V2 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
export const SERVICE_SHOP = '5a7b9c1d-2e3f-4a5b-8c6d-7e8f9a0b4001';

export const mockServices: ServiceDetail[] = [
  {
    id: SERVICE_SHOP,
    name: 'shop-api',
    description: 'Demo shopping API',
    repoUrl: 'https://github.com/team-echo/shop-api',
    private: false,
    healthCheckPath: '/healthz',
    healthCheckTimeoutSeconds: 300,
    containerPort: 8080,
    url: 'https://shop-api-k3x9q2m7.echoport.uk',
    status: 'ACTIVE',
    deleteError: null,
    simulated: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    environments: [
      {
        serviceEnvironmentId: '6b8c0d2e-3f4a-4b5c-9d7e-8f9a0b1c5001',
        environment: { id: ENV_TOKYO, name: 'aws-tokyo-prod', kind: 'aws' },
        role: 'SERVING',
        trafficWeight: 100,
        url: 'https://shop-api-aws-tokyo-prod-k3x9q2m7.echoport.uk',
        currentDeployment: {
          id: 'd-1',
          commitSha: SHA_V2,
          imageDigest: `sha256:${'a'.repeat(64)}`,
          finishedAt: '2026-11-02T05:10:00Z',
        },
        versionStatus: null,
        lastSyncError: null,
        activeRequestId: null,
        queuedRequestId: null,
        simulated: true,
        teardownError: null,
      },
      {
        serviceEnvironmentId: '6b8c0d2e-3f4a-4b5c-9d7e-8f9a0b1c5002',
        environment: { id: ENV_SEOUL, name: 'gcp-seoul-standby', kind: 'gcp' },
        role: 'STANDBY',
        trafficWeight: 0,
        url: 'https://shop-api-gcp-seoul-standby-k3x9q2m7.echoport.uk',
        currentDeployment: {
          id: 'd-2',
          commitSha: SHA_V2,
          imageDigest: `sha256:${'a'.repeat(64)}`,
          finishedAt: '2026-11-02T05:12:00Z',
        },
        versionStatus: 'IN_SYNC',
        lastSyncError: null,
        activeRequestId: null,
        queuedRequestId: null,
        simulated: true,
        teardownError: null,
      },
    ],
  },
];

/** 목업 배포 요청. 단계 시각은 접수 시각에서 계산한다(handlers.ts 의 advance) */
export type MockDeployRequest = DeployRequestDetail & {
  /** 접수 시각(ms). 이 시각부터 단계가 진행된다 */
  acceptedAt: number;
  failAt: 'BUILDING' | 'DEPLOYING' | 'VERIFYING' | null;
};

function finishedRequest(
  id: string,
  environment: { id: string; name: string; kind: string },
  serviceEnvironmentId: string,
  sha: string,
  queuedAt: string,
  trigger: 'MANUAL' | 'STANDBY_SYNC',
): MockDeployRequest {
  const at = (offset: number) =>
    new Date(new Date(queuedAt).getTime() + offset * 1000).toISOString();
  return {
    id,
    serviceId: SERVICE_SHOP,
    environment,
    serviceEnvironmentId,
    trigger,
    sourceRequestId: null,
    ref: { type: 'BRANCH', value: 'main' },
    commitSha: sha,
    status: 'SUCCEEDED',
    cancelReason: null,
    errorCode: null,
    revertStatus: null,
    stageTimes: {
      queuedAt,
      buildingAt: at(2),
      deployingAt: at(40),
      verifyingAt: at(70),
      finishedAt: at(85),
    },
    simulated: true,
    repoUrl: 'https://github.com/team-echo/shop-api',
    supersededById: null,
    errorMessage: null,
    build: {
      id: `b-${id}`,
      status: 'SUCCEEDED',
      imageRepository: 'ghcr.io/team-echo/shop-api',
      imageDigest: `sha256:${'a'.repeat(64)}`,
      reused: trigger === 'STANDBY_SYNC',
    },
    deploymentId: `d-${id}`,
    urls: {
      main: 'https://shop-api-k3x9q2m7.echoport.uk',
      environment: `https://shop-api-${environment.name}-k3x9q2m7.echoport.uk`,
    },
    acceptedAt: new Date(queuedAt).getTime(),
    failAt: null,
  };
}

export const mockDeployRequests: MockDeployRequest[] = [
  finishedRequest(
    '7c9d1e3f-4a5b-4c6d-8e7f-9a0b1c2d6003',
    { id: ENV_SEOUL, name: 'gcp-seoul-standby', kind: 'gcp' },
    '6b8c0d2e-3f4a-4b5c-9d7e-8f9a0b1c5002',
    SHA_V2,
    '2026-11-02T05:10:30Z',
    'STANDBY_SYNC',
  ),
  finishedRequest(
    '7c9d1e3f-4a5b-4c6d-8e7f-9a0b1c2d6002',
    { id: ENV_TOKYO, name: 'aws-tokyo-prod', kind: 'aws' },
    '6b8c0d2e-3f4a-4b5c-9d7e-8f9a0b1c5001',
    SHA_V2,
    '2026-11-02T05:08:30Z',
    'MANUAL',
  ),
  finishedRequest(
    '7c9d1e3f-4a5b-4c6d-8e7f-9a0b1c2d6001',
    { id: ENV_TOKYO, name: 'aws-tokyo-prod', kind: 'aws' },
    '6b8c0d2e-3f4a-4b5c-9d7e-8f9a0b1c5001',
    SHA_V1,
    '2026-11-01T09:00:00Z',
    'MANUAL',
  ),
];
