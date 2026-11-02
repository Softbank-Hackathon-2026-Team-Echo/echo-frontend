// MOCK: echo-was 응답을 흉내 내는 MSW 핸들러. 서버 API 가 열리면 해당 핸들러를 지운다.
// 목업 상태는 메모리에만 있고 새로고침하면 처음으로 돌아간다.
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

const environments = [...mockEnvironments];
const services = [...mockServices];
const deployRequests = [...mockDeployRequests];

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
    request.status = stage;
    request.stageTimes[STAGE_TIME_KEY[stage]] = new Date(startsAt).toISOString();
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
  if (request.status !== 'SUCCEEDED') return;
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
  const serving = service.environments.find((item) => item.role === 'SERVING');
  for (const item of service.environments) {
    item.versionStatus =
      item.role === 'STANDBY'
        ? item.currentDeployment?.commitSha === serving?.currentDeployment?.commitSha
          ? 'IN_SYNC'
          : 'OUT_OF_SYNC'
        : null;
  }
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
    environments.push(environment);
    return ok(mockEnvironmentDetail(environment), 201);
  }),

  http.get(`${API}/orgs/:orgId/environments/:environmentId`, ({ params }) => {
    if (!hasOrganization(params.orgId)) return orgNotFound();
    const environment = environments.find((env) => env.id === params.environmentId);
    if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    return ok(mockEnvironmentDetail(environment));
  }),

  http.patch(`${API}/orgs/:orgId/environments/:environmentId`, async ({ params, request }) => {
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
      // 설정이 바뀌면 다시 확인해야 한다
      connectionStatus: 'UNCHECKED',
      connectionCheckedAt: null,
      connectionError: null,
      updatedAt: new Date().toISOString(),
    } satisfies Partial<EnvironmentSummary>);
    return ok(mockEnvironmentDetail(environment));
  }),

  http.post(`${API}/orgs/:orgId/environments/:environmentId/connection-check`, ({ params }) => {
    const environment = environments.find((env) => env.id === params.environmentId);
    if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    environment.connectionStatus = 'CONNECTED';
    environment.connectionCheckedAt = new Date().toISOString();
    environment.connectionError = null;
    return ok(mockEnvironmentDetail(environment));
  }),

  http.delete(`${API}/orgs/:orgId/environments/:environmentId`, ({ params }) => {
    const index = environments.findIndex((env) => env.id === params.environmentId);
    if (index < 0) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    const inUse = services.some((service) =>
      service.environments.some((link) => link.environment.id === params.environmentId),
    );
    if (inUse) return fail(409, 'ENVIRONMENT_IN_USE', 'environment has services');
    environments.splice(index, 1);
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
    return ok(service, 201);
  }),

  http.get(`${API}/orgs/:orgId/services/:serviceId`, ({ params }) => {
    const service = services.find((item) => item.id === params.serviceId);
    if (!service) return fail(404, 'SERVICE_NOT_FOUND', 'service not found');
    return ok(serviceView(service));
  }),

  http.delete(`${API}/orgs/:orgId/services/:serviceId`, ({ params }) => {
    const index = services.findIndex((item) => item.id === params.serviceId);
    if (index < 0) return fail(404, 'SERVICE_NOT_FOUND', 'service not found');
    const [service] = services.splice(index, 1);
    return ok({ ...service, status: 'DELETING' }, 202);
  }),

  // 배포 요청
  http.post(
    `${API}/orgs/:orgId/services/:serviceId/deploy-requests`,
    async ({ params, request }) => {
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
      const acceptedAt = Date.now();
      const created: MockDeployRequest = {
        id: crypto.randomUUID(),
        serviceId: service.id,
        environment: link.environment,
        serviceEnvironmentId: link.serviceEnvironmentId,
        trigger: 'MANUAL',
        sourceRequestId: null,
        ref: body.branch
          ? { type: 'BRANCH', value: body.branch }
          : { type: 'COMMIT', value: commitSha },
        commitSha,
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
            (item) => item.commitSha === commitSha && item.status === 'SUCCEEDED',
          ),
        },
        deploymentId: null,
        urls: { main: service.url, environment: link.url },
        acceptedAt,
        failAt: body.simulate?.failAt ?? null,
      };
      link.activeRequestId = created.id;
      deployRequests.unshift(created);
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
