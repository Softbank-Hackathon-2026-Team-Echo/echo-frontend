import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type {
  EnvironmentSummary,
  Me,
  SecurityFinding,
  SecurityMatrixCell,
  SecurityMatrixRow,
} from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import SecurityPage from './SecurityPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-04T03:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

const me: Me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role: 'DEVELOPER',
      allowSelfApproval: false,
      createdAt: AT,
    },
  ],
};

const environment = (id: string, name: string, kind: string): EnvironmentSummary => ({
  id,
  name,
  kind,
  location: null,
  coordinates: null,
  config: {},
  secretRef: null,
  connectionStatus: 'CONNECTED',
  connectionCheckedAt: AT,
  connectionError: null,
  createdAt: AT,
  updatedAt: AT,
});

const emptyCell: SecurityMatrixCell = {
  result: 'UNKNOWN',
  findingCount: 0,
  hasException: false,
  mode: null,
  checkedAt: null,
  expiresAt: null,
  controls: [
    {
      controlId: 'C-IAM-1',
      title: 'Least privilege',
      result: 'UNKNOWN',
      isMandatory: true,
      reasons: ['EVIDENCE_MISSING'],
      findingIds: [],
      mode: null,
      checkedAt: null,
      expiresAt: null,
      serviceId: null,
    },
  ],
};

const warnCell: SecurityMatrixCell = {
  result: 'WARN',
  findingCount: 2,
  hasException: false,
  mode: 'REAL',
  checkedAt: AT,
  expiresAt: AT,
  controls: [
    {
      controlId: 'C-IMG-1',
      title: 'Image vulnerabilities',
      result: 'WARN',
      isMandatory: true,
      reasons: ['CONTROL_WARNING'],
      findingIds: ['f1'],
      mode: 'REAL',
      checkedAt: AT,
      expiresAt: AT,
      serviceId: 's1',
    },
    {
      controlId: 'C-IMG-2',
      title: 'Secrets in image',
      result: 'PASS',
      isMandatory: true,
      reasons: [],
      findingIds: ['f2'],
      mode: 'REAL',
      checkedAt: AT,
      expiresAt: AT,
      serviceId: 's1',
    },
  ],
};

const row = (
  environmentId: string,
  environmentName: string,
  policy = emptyCell,
): SecurityMatrixRow => ({
  environmentId,
  environmentName,
  environmentKind: 'aws',
  services: [{ serviceId: 's1', name: 'demo', imageDigest: 'sha256:abc' }],
  cells: { iam: emptyCell, encryption: emptyCell, auditLog: emptyCell, policy },
});

const finding: SecurityFinding = {
  id: 'f1',
  controlId: 'C-IMG-1',
  result: 'WARN',
  reason: 'UNFIXED_HIGH_VULNERABILITY',
  source: 'TRIVY_IMAGE',
  origin: 'RULE',
  mode: 'REAL',
  confirmation: null,
  policyVersion: 'sec-rules-2026.11.04',
  toolVersion: '0.69.0',
  serviceId: 's1',
  environmentId: 'e1',
  imageDigest: 'sha256:877f0baf0000111122223333',
  configCommit: null,
  wasVersion: null,
  collectedAt: AT,
  expiresAt: AT,
  evidenceRef: 'actions/runs/41834516657',
  reviewerUserId: null,
  basisUrl: null,
  items: [{ itemId: 'CVE-2026-1', severity: 'HIGH', target: 'libssl', installedVersion: '1.0' }],
  totalItems: 3,
};

function serve(items: EnvironmentSummary[], findings: SecurityFinding[] = [finding]) {
  const findingQueries: string[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({ items, total: items.length, page: 0, size: 100 }),
    ),
    http.get(`${API}/orgs/o1/security/matrix`, () =>
      ok({
        policyVersion: 'sec-rules-2026.11.04',
        phase: 'PREPARATION',
        checkedAt: AT,
        rows: items.map((item, index) =>
          row(item.id, item.name, index === 0 ? warnCell : emptyCell),
        ),
      }),
    ),
    http.get(`${API}/orgs/o1/security/findings`, ({ request }) => {
      findingQueries.push(new URL(request.url).search);
      return ok({ items: findings, total: findings.length, page: 0, size: 100 });
    }),
  );
  return findingQueries;
}

function renderPage() {
  return renderRoute(<SecurityPage />, { path: '/o/:slug/security', url: '/o/echo-demo/security' });
}

const ENVIRONMENTS = [
  environment('e1', 'aws-tokyo', 'aws'),
  environment('e2', 'gcp-seoul', 'gcp'),
  environment('e3', 'onprem-k3s', 'onprem'),
];

describe('SecurityPage', () => {
  it('환경마다 네 칸을 서버 값으로 그리고 simulated 를 달지 않는다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'aws-tokyo Policy: 1 issue' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'gcp-seoul IAM: Unknown' })).toBeInTheDocument();
    expect(screen.getByText(/Policy sec-rules-2026.11.04/)).toBeInTheDocument();
    expect(screen.queryByText('simulated')).not.toBeInTheDocument();
  });

  it('칸을 누르면 통제별 판정과 그 칸의 증거를 부른다', async () => {
    const queries = serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'aws-tokyo Policy: 1 issue' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('aws-tokyo · Policy')).toBeInTheDocument();
    expect(within(sheet).getByText('Image vulnerabilities')).toBeInTheDocument();
    expect(within(sheet).getByText('Warning on this control')).toBeInTheDocument();
    expect(await within(sheet).findByText('UNFIXED_HIGH_VULNERABILITY')).toBeInTheDocument();
    expect(within(sheet).getByText(/CVE-2026-1/)).toBeInTheDocument();
    expect(within(sheet).getByText('Showing 1 of 3 items')).toBeInTheDocument();
    expect(queries.some((query) => query.includes('findingId=f1&findingId=f2'))).toBe(true);
  });

  it('미수집 칸은 증거가 없다는 이유를 보인다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'gcp-seoul IAM: Unknown' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('No evidence collected')).toBeInTheDocument();
  });

  it('증거 표의 행을 누르면 그 증거가 열린다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Findings' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Image vulnerabilities' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('actions/runs/41834516657')).toBeInTheDocument();
  });

  it('서버가 SIMULATED 증거를 주면 simulated 를 밝힌다', async () => {
    serve(ENVIRONMENTS, [{ ...finding, mode: 'SIMULATED' }]);
    renderPage();

    expect(await screen.findByText('simulated')).toBeInTheDocument();
  });

  it('매트릭스를 못 불러오면 오류를 보인다', async () => {
    serve(ENVIRONMENTS);
    server.use(
      http.get(`${API}/orgs/o1/security/matrix`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'no' } },
          { status: 503 },
        ),
      ),
    );
    renderPage();

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('Compare 탭은 두 환경을 나란히 보여 준다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Compare' }));

    expect(
      await screen.findByRole('heading', { name: 'Compare environments' }),
    ).toBeInTheDocument();
    expect(screen.getByText('warning only')).toBeInTheDocument();
    expect(screen.getByText('simulated')).toBeInTheDocument();
    expect(screen.queryByText('blocks migration')).not.toBeInTheDocument();
  });

  it('환경이 없으면 등록을 안내한다', async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText('No environments yet')).toBeInTheDocument();
  });
});
