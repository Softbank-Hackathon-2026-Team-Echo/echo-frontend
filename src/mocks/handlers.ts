// MOCK: echo-was 응답을 흉내 내는 MSW 핸들러. 서버 API 가 열리면 해당 핸들러를 지운다.
// 목업 상태는 탭 단위(sessionStorage)로 남아 새로고침해도 유지되고, 탭을 닫으면 처음으로 돌아간다.
import { HttpResponse, http } from 'msw';
import type {
  CreateDeploy,
  CreateEnvironment,
  CreateService,
  EnvironmentSummary,
  ServiceDetail,
  UpdateEnvironment,
} from '@/lib/api/types';
import {
  type MockDeployRequest,
  makeEnvironment,
  mockDeployRequests,
  mockEnvironmentDetail,
  mockEnvironmentKinds,
  mockEnvironments,
  mockMe,
  mockOrganizations,
  mockServices,
} from './data';

const API = '*/api/v1';

const STORAGE_KEY = 'echoport.mock.v1';

type MockState = {
  environments: EnvironmentSummary[];
  services: ServiceDetail[];
  deployRequests: MockDeployRequest[];
};

function initialState(): MockState {
  return structuredClone({
    environments: mockEnvironments,
    services: mockServices,
    deployRequests: mockDeployRequests,
  });
}

function loadState(): MockState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // 저장소를 못 쓰면 메모리 상태로 시작한다
  }
  return initialState();
}

const state = loadState();
const { environments, services, deployRequests } = state;

/** 바뀐 목업 상태를 탭 저장소에 남긴다 (시연 중 새로고침해도 만든 서비스·환경이 남게) */
function save() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장하지 못해도 이번 화면에서는 동작한다
  }
}

function headers() {
  return { 'X-Request-ID': crypto.randomUUID() };
}

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status, headers: headers() });
}

function fail(
  status: number,
  code: string,
  message: string,
  details?: { field: string; reason: string; value?: string }[],
) {
  return HttpResponse.json(
    { success: false, code, message, details },
    { status, headers: headers() },
  );
}

function page<T>(items: T[], request: Request) {
  const url = new URL(request.url);
  const pageIndex = Number(url.searchParams.get('page') ?? 0);
  const size = Number(url.searchParams.get('size') ?? 20);
  return {
    items: items.slice(pageIndex * size, pageIndex * size + size),
    total: items.length,
    page: pageIndex,
    size,
  };
}

function hasOrganization(orgId: string | readonly string[] | undefined) {
  return mockOrganizations.some((org) => org.id === orgId);
}

const orgNotFound = () => fail(404, 'ORGANIZATION_NOT_FOUND', 'organization not found');

/** 뷰어 조직의 변경 요청은 echo-was 처럼 403 ROLE_FORBIDDEN 으로 막는다 */
function forbiddenForViewer(orgId: string | readonly string[] | undefined) {
  const org = mockOrganizations.find((item) => item.id === orgId);
  return org?.role === 'VIEWER' ? fail(403, 'ROLE_FORBIDDEN', 'role forbidden') : null;
}
const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// 배포 단계 시간(초). 데모에서 지켜보기 좋게 짧게 둔다
const STAGE_SECONDS = { QUEUED: 1.5, BUILDING: 3.5, DEPLOYING: 3, VERIFYING: 2.5 } as const;
const STAGES = ['QUEUED', 'BUILDING', 'DEPLOYING', 'VERIFYING'] as const;
const FAILURE_CODES = {
  BUILDING: 'BUILD_FAILED',
  DEPLOYING: 'DEPLOY_FAILED',
  VERIFYING: 'HEALTH_CHECK_FAILED',
} as const;
const STAGE_TIME_KEY = {
  QUEUED: 'queuedAt',
  BUILDING: 'buildingAt',
  DEPLOYING: 'deployingAt',
  VERIFYING: 'verifyingAt',
} as const;

/** 접수 시각에서 흐른 시간으로 배포 요청을 진행시킨다. 끝나면 서비스 연결에 반영한다 */
function advance(request: MockDeployRequest, now = Date.now()) {
  if (
    request.status === 'SUCCEEDED' ||
    request.status === 'FAILED' ||
    request.status === 'CANCELLED'
  )
    return;
  let cursor = request.acceptedAt;
  for (const stage of STAGES) {
    const startsAt = cursor;
    const endsAt = cursor + STAGE_SECONDS[stage] * 1000;
    if (now < startsAt) return;
    if (request.status !== stage) {
      request.status = stage;
      request.stageTimes[STAGE_TIME_KEY[stage]] = new Date(startsAt).toISOString();
      save();
    }
    if (request.failAt === stage && now >= startsAt + (endsAt - startsAt) / 2) {
      request.status = 'FAILED';
      request.errorCode = FAILURE_CODES[stage as keyof typeof FAILURE_CODES];
      request.errorMessage = `simulated failure at ${stage}`;
      request.revertStatus = stage === 'BUILDING' ? null : 'SUCCEEDED';
      request.stageTimes.finishedAt = new Date(startsAt + (endsAt - startsAt) / 2).toISOString();
      settle(request);
      return;
    }
    if (now < endsAt) return;
    cursor = endsAt;
  }
  request.status = 'SUCCEEDED';
  request.stageTimes.finishedAt = new Date(cursor).toISOString();
  if (request.build) request.build.status = 'SUCCEEDED';
  settle(request);
}

/** 끝난 요청을 서비스 연결에 반영: 진행 표시를 지우고, 성공이면 현재 배포를 바꾼다 */
function settle(request: MockDeployRequest) {
  const service = services.find((item) => item.id === request.serviceId);
  const link = service?.environments.find(
    (item) => item.serviceEnvironmentId === request.serviceEnvironmentId,
  );
  if (!service || !link) return;
  link.activeRequestId = null;
  if (request.status === 'SUCCEEDED') {
    link.currentDeployment = {
      id: `d-${request.id}`,
      commitSha: request.commitSha,
      imageDigest: `sha256:${'b'.repeat(64)}`,
      finishedAt: request.stageTimes.finishedAt,
    };
    // 첫 성공 연결이 서비스 중이 된다. 나머지는 예비로 같은 버전을 따라간다
    if (!service.environments.some((item) => item.role === 'SERVING')) {
      link.role = 'SERVING';
      link.trafficWeight = 100;
    } else if (link.role !== 'SERVING') {
      link.role = 'STANDBY';
    }
    // 서비스 중 연결이 성공하면 예비 연결이 같은 빌드로 자동 배포된다 (echo-was STANDBY_SYNC)
    if (link.role === 'SERVING') {
      for (const other of service.environments) {
        if (other === link || !other.currentDeployment || other.activeRequestId) continue;
        if (other.currentDeployment.commitSha === request.commitSha) continue;
        const sync = createRequest(service, other, {
          ref: request.ref,
          commitSha: request.commitSha,
          trigger: 'STANDBY_SYNC',
          sourceRequestId: request.id,
          failAt: null,
        });
        deployRequests.unshift(sync);
      }
    }
  }
  const serving = service.environments.find((item) => item.role === 'SERVING');
  for (const item of service.environments) {
    item.versionStatus =
      item.role === 'STANDBY'
        ? item.currentDeployment?.commitSha === serving?.currentDeployment?.commitSha
          ? 'IN_SYNC'
          : 'OUT_OF_SYNC'
        : null;
  }
  save();
}

/** 배포 요청 하나를 만들고 연결에 "진행 중"으로 건다 */
function createRequest(
  service: ServiceDetail,
  link: ServiceDetail['environments'][number],
  options: {
    ref: MockDeployRequest['ref'];
    commitSha: string;
    trigger: MockDeployRequest['trigger'];
    sourceRequestId: string | null;
    failAt: MockDeployRequest['failAt'];
  },
): MockDeployRequest {
  const acceptedAt = Date.now();
  const request: MockDeployRequest = {
    id: crypto.randomUUID(),
    serviceId: service.id,
    environment: link.environment,
    serviceEnvironmentId: link.serviceEnvironmentId,
    trigger: options.trigger,
    sourceRequestId: options.sourceRequestId,
    ref: options.ref,
    commitSha: options.commitSha,
    status: 'QUEUED',
    cancelReason: null,
    errorCode: null,
    revertStatus: null,
    stageTimes: {
      queuedAt: new Date(acceptedAt).toISOString(),
      buildingAt: null,
      deployingAt: null,
      verifyingAt: null,
      finishedAt: null,
    },
    simulated: true,
    repoUrl: service.repoUrl,
    supersededById: null,
    errorMessage: null,
    // 같은 커밋을 이미 빌드했으면 이미지를 다시 쓴다
    build: {
      id: crypto.randomUUID(),
      status: 'RUNNING',
      imageRepository: null,
      imageDigest: null,
      reused: deployRequests.some(
        (item) => item.commitSha === options.commitSha && item.status === 'SUCCEEDED',
      ),
    },
    deploymentId: null,
    urls: { main: service.url, environment: link.url },
    acceptedAt,
    failAt: options.failAt,
  };
  link.activeRequestId = request.id;
  return request;
}

/**
 * 접속 확인 흉내. echo-was 는 등록·설정 변경 때 바로 확인한다.
 * 비밀 참조 이름에 MISSING 이 들어가면 서버에 비밀값이 없는 경우(SECRET_NOT_FOUND)를 흉내 낸다
 */
function checkConnection(environment: EnvironmentSummary) {
  const missing = /MISSING/i.test(environment.secretRef ?? '');
  environment.connectionStatus = missing ? 'FAILED' : 'CONNECTED';
  environment.connectionError = missing ? 'SECRET_NOT_FOUND' : null;
  environment.connectionCheckedAt = new Date().toISOString();
}

function serviceView(service: ServiceDetail) {
  for (const request of deployRequests) {
    if (request.serviceId === service.id) advance(request);
  }
  return service;
}

function summary(request: MockDeployRequest) {
  const {
    acceptedAt: _acceptedAt,
    failAt: _failAt,
    repoUrl: _repoUrl,
    supersededById: _s,
    errorMessage: _e,
    build: _b,
    deploymentId: _d,
    urls: _u,
    ...rest
  } = request;
  return rest;
}

function detail(request: MockDeployRequest) {
  const { acceptedAt: _acceptedAt, failAt: _failAt, ...rest } = request;
  return rest;
}

export const handlers = [
  http.get(`${API}/me`, () => ok(mockMe)),

  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API}/environment-kinds`, () => ok(mockEnvironmentKinds)),

  // 환경
  http.get(`${API}/orgs/:orgId/environments`, ({ params, request }) => {
    if (!hasOrganization(params.orgId)) return orgNotFound();
    return ok(page(environments, request));
  }),

  http.post(`${API}/orgs/:orgId/environments`, async ({ params, request }) => {
    const denied = forbiddenForViewer(params.orgId);
    if (denied) return denied;
    if (!hasOrganization(params.orgId)) return orgNotFound();
    const body = (await request.json()) as CreateEnvironment;
    if (!NAME_PATTERN.test(body.name)) {
      return fail(422, 'VALIDATION_ERROR', 'invalid name', [
        { field: 'name', reason: 'INVALID_NAME' },
      ]);
    }
    if (environments.some((item) => item.name === body.name)) {
      return fail(409, 'ENVIRONMENT_NAME_CONFLICT', 'name already used', [
        { field: 'name', reason: 'ENVIRONMENT_NAME_CONFLICT' },
      ]);
    }
    if (!/^(env:ECHO_SECRET_[A-Z0-9_]+|k8s:.+|aws-sm:.+|gcp-sm:.+)$/.test(body.secretRef)) {
      return fail(422, 'VALIDATION_ERROR', 'invalid secret ref', [
        { field: 'secretRef', reason: 'INVALID_SECRET_REF' },
      ]);
    }
    const location = String(body.config.region ?? body.config.location ?? '') || null;
    const environment = makeEnvironment({
      id: crypto.randomUUID(),
      name: body.name,
      kind: body.kind,
      location,
      config: body.config,
      secretRef: body.secretRef,
    });
    checkConnection(environment);
    environments.push(environment);
    save();
    return ok(mockEnvironmentDetail(environment), 201);
  }),

  http.get(`${API}/orgs/:orgId/environments/:environmentId`, ({ params }) => {
    if (!hasOrganization(params.orgId)) return orgNotFound();
    const environment = environments.find((env) => env.id === params.environmentId);
    if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    return ok(mockEnvironmentDetail(environment));
  }),

  http.patch(`${API}/orgs/:orgId/environments/:environmentId`, async ({ params, request }) => {
    const denied = forbiddenForViewer(params.orgId);
    if (denied) return denied;
    const environment = environments.find((env) => env.id === params.environmentId);
    if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    const body = (await request.json()) as UpdateEnvironment;
    Object.assign(environment, {
      ...(body.name ? { name: body.name } : {}),
      ...(body.config
        ? {
            config: body.config,
            location: String(body.config.region ?? body.config.location ?? '') || null,
          }
        : {}),
      ...(body.secretRef ? { secretRef: body.secretRef } : {}),
      updatedAt: new Date().toISOString(),
    } satisfies Partial<EnvironmentSummary>);
    // 설정이 바뀌면 echo-was 가 그 자리에서 다시 확인한다
    if (body.config || body.secretRef) checkConnection(environment);
    save();
    return ok(mockEnvironmentDetail(environment));
  }),

  http.post(`${API}/orgs/:orgId/environments/:environmentId/connection-check`, ({ params }) => {
    const denied = forbiddenForViewer(params.orgId);
    if (denied) return denied;
    const environment = environments.find((env) => env.id === params.environmentId);
    if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    checkConnection(environment);
    save();
    return ok(mockEnvironmentDetail(environment));
  }),

  http.delete(`${API}/orgs/:orgId/environments/:environmentId`, ({ params }) => {
    const denied = forbiddenForViewer(params.orgId);
    if (denied) return denied;
    const index = environments.findIndex((env) => env.id === params.environmentId);
    if (index < 0) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    const inUse = services.some((service) =>
      service.environments.some((link) => link.environment.id === params.environmentId),
    );
    if (inUse) return fail(409, 'ENVIRONMENT_IN_USE', 'environment has services');
    environments.splice(index, 1);
    save();
    return new HttpResponse(null, { status: 204, headers: headers() });
  }),

  // 서비스
  http.get(`${API}/orgs/:orgId/services`, ({ params, request }) => {
    if (!hasOrganization(params.orgId)) return orgNotFound();
    return ok(
      page(
        services.map(({ environments: _links, ...rest }) => rest),
        request,
      ),
    );
  }),

  http.post(`${API}/orgs/:orgId/services`, async ({ params, request }) => {
    const denied = forbiddenForViewer(params.orgId);
    if (denied) return denied;
    if (!hasOrganization(params.orgId)) return orgNotFound();
    const body = (await request.json()) as CreateService;
    if (!NAME_PATTERN.test(body.name)) {
      return fail(422, 'VALIDATION_ERROR', 'invalid name', [
        { field: 'name', reason: 'INVALID_NAME' },
      ]);
    }
    const repo = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?\/?$/.exec(body.repoUrl);
    if (!repo) {
      return fail(422, 'VALIDATION_ERROR', 'invalid repo url', [
        { field: 'repoUrl', reason: 'INVALID_REPO_URL' },
      ]);
    }
    // echo-was 가짜 소스 규칙: owner 가 denied-·missing- 이면 접근 불가
    if (/^(denied|missing)-/.test(repo[1] ?? '')) {
      return fail(404, 'REPO_NOT_ACCESSIBLE', 'repository not found or not accessible', [
        {
          field: 'installUrl',
          reason: 'INSTALL_GITHUB_APP',
          value: 'https://github.com/apps/echo-deploy/installations/new',
        },
      ]);
    }
    if (services.some((service) => service.name === body.name)) {
      return fail(409, 'SERVICE_NAME_CONFLICT', 'name already used', [
        { field: 'name', reason: 'SERVICE_NAME_CONFLICT' },
      ]);
    }
    const suffix = Math.random().toString(36).slice(2, 10);
    const now = new Date().toISOString();
    const service: ServiceDetail = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description ?? null,
      repoUrl: body.repoUrl,
      private: (repo[1] ?? '').startsWith('private-'),
      healthCheckPath: body.healthCheckPath ?? '/healthz',
      healthCheckTimeoutSeconds: body.healthCheckTimeoutSeconds ?? 300,
      containerPort: body.containerPort ?? 8080,
      url: `https://${body.name}-${suffix}.echoport.uk`,
      status: 'ACTIVE',
      deleteError: null,
      simulated: true,
      createdAt: now,
      updatedAt: now,
      environments: [],
    };
    services.push(service);
    save();
    return ok(service, 201);
  }),

  http.get(`${API}/orgs/:orgId/services/:serviceId`, ({ params }) => {
    const service = services.find((item) => item.id === params.serviceId);
    if (!service) return fail(404, 'SERVICE_NOT_FOUND', 'service not found');
    return ok(serviceView(service));
  }),

  http.delete(`${API}/orgs/:orgId/services/:serviceId`, ({ params }) => {
    const denied = forbiddenForViewer(params.orgId);
    if (denied) return denied;
    const index = services.findIndex((item) => item.id === params.serviceId);
    if (index < 0) return fail(404, 'SERVICE_NOT_FOUND', 'service not found');
    const [service] = services.splice(index, 1);
    save();
    return ok({ ...service, status: 'DELETING' }, 202);
  }),

  // 배포 요청
  http.post(
    `${API}/orgs/:orgId/services/:serviceId/deploy-requests`,
    async ({ params, request }) => {
      const denied = forbiddenForViewer(params.orgId);
      if (denied) return denied;
      const service = services.find((item) => item.id === params.serviceId);
      if (!service) return fail(404, 'SERVICE_NOT_FOUND', 'service not found');
      const body = (await request.json()) as CreateDeploy;
      if (Boolean(body.branch) === Boolean(body.commitSha)) {
        return fail(422, 'VALIDATION_ERROR', 'exactly one of branch or commitSha', [
          { field: 'branch', reason: 'EXACTLY_ONE_OF_BRANCH_OR_COMMIT_SHA' },
        ]);
      }
      const environment = environments.find((env) => env.id === body.environmentId);
      if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
      if (environment.connectionStatus === 'FAILED')
        return fail(409, 'ENVIRONMENT_UNHEALTHY', 'environment unhealthy');

      let link = service.environments.find((item) => item.environment.id === environment.id);
      if (!link) {
        link = {
          serviceEnvironmentId: crypto.randomUUID(),
          environment: { id: environment.id, name: environment.name, kind: environment.kind },
          role: 'NONE',
          trafficWeight: 0,
          url: service.url.replace(
            /^https:\/\/([^-]+(?:-[^-]+)*)-([a-z0-9]{8})\./,
            `https://$1-${environment.name}-$2.`,
          ),
          currentDeployment: null,
          versionStatus: null,
          lastSyncError: null,
          activeRequestId: null,
          queuedRequestId: null,
          simulated: true,
          teardownError: null,
        };
        service.environments.push(link);
      }
      const commitSha =
        body.commitSha ??
        Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const created = createRequest(service, link, {
        ref: body.branch
          ? { type: 'BRANCH', value: body.branch }
          : { type: 'COMMIT', value: commitSha },
        commitSha,
        trigger: 'MANUAL',
        sourceRequestId: null,
        failAt: body.simulate?.failAt ?? null,
      });
      deployRequests.unshift(created);
      save();
      return ok(detail(created), 202);
    },
  ),

  http.get(`${API}/orgs/:orgId/services/:serviceId/deploy-requests`, ({ params, request }) => {
    const items = deployRequests.filter((item) => item.serviceId === params.serviceId);
    for (const item of items) advance(item);
    return ok(page(items.map(summary), request));
  }),

  http.get(`${API}/orgs/:orgId/deploy-requests/:deployRequestId`, ({ params }) => {
    const found = deployRequests.find((item) => item.id === params.deployRequestId);
    if (!found) return fail(404, 'DEPLOY_REQUEST_NOT_FOUND', 'deploy request not found');
    advance(found);
    return ok(detail(found));
  }),
];
