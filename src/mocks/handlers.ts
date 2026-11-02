// MOCK: echo-was 응답을 흉내 내는 MSW 핸들러. 서버 API 가 열리면 해당 핸들러를 지운다
import { HttpResponse, http } from 'msw';
import { mockEnvironmentDetail, mockEnvironments, mockMe, mockOrganizations } from './data';

const API = '*/api/v1';

function ok<T>(data: T) {
  return HttpResponse.json(
    { success: true, data },
    { headers: { 'X-Request-ID': crypto.randomUUID() } },
  );
}

function fail(status: number, code: string, message: string) {
  return HttpResponse.json(
    { success: false, code, message },
    { status, headers: { 'X-Request-ID': crypto.randomUUID() } },
  );
}

function findOrganization(orgId: string | readonly string[] | undefined) {
  return mockOrganizations.find((org) => org.id === orgId);
}

export const handlers = [
  http.get(`${API}/me`, () => ok(mockMe)),

  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API}/orgs/:orgId/environments`, ({ params, request }) => {
    if (!findOrganization(params.orgId)) {
      return fail(404, 'ORGANIZATION_NOT_FOUND', 'organization not found');
    }
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);
    const items = mockEnvironments.slice(page * size, page * size + size);
    return ok({ items, total: mockEnvironments.length, page, size });
  }),

  http.get(`${API}/orgs/:orgId/environments/:environmentId`, ({ params }) => {
    if (!findOrganization(params.orgId)) {
      return fail(404, 'ORGANIZATION_NOT_FOUND', 'organization not found');
    }
    const environment = mockEnvironments.find((env) => env.id === params.environmentId);
    if (!environment) return fail(404, 'ENVIRONMENT_NOT_FOUND', 'environment not found');
    return ok(mockEnvironmentDetail(environment));
  }),
];
