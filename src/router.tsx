import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell, type RouteHandle } from '@/layouts/AppShell';
import { k } from '@/lib/i18n';
import { registerPrefetchRoutes } from '@/lib/route-prefetch';
import NotFoundPage from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { RouteLoading } from '@/pages/RouteLoading';

function crumb(name: string): RouteHandle {
  return { crumb: name };
}

// 경로 이름은 ui-terms §3 표를 따른다. 화면이 생기면 PlaceholderPage 를 실제 페이지로 바꾼다
const routes: RouteObject[] = [
  {
    path: '/login',
    HydrateFallback: RouteLoading,
    lazy: () => import('@/pages/login/LoginPage').then((m) => ({ Component: m.default })),
  },
  {
    path: '/',
    HydrateFallback: RouteLoading,
    lazy: () => import('@/pages/root/RootRedirect').then((m) => ({ Component: m.default })),
  },
  {
    // 온보딩은 사이드바 없이 한 화면을 다 쓴다(Figma O01~O03)
    path: '/o/:slug/onboarding',
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    lazy: () => import('@/pages/onboarding/OnboardingPage').then((m) => ({ Component: m.default })),
  },
  {
    // 시연 리모컨은 휴대폰 한 화면이라 사이드바가 없다(Figma S01-R)
    path: '/o/:slug/remote',
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    lazy: () => import('@/pages/remote/RemotePage').then((m) => ({ Component: m.default })),
  },
  {
    // R2b 시연용 충격 트리거: 휴대폰을 흔들거나 떨어뜨리면 재난을 선언한다(모의 재난)
    path: '/o/:slug/remote/shake',
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    lazy: () => import('@/pages/remote/ShakeRemotePage').then((m) => ({ Component: m.default })),
  },
  {
    // 노트북 온프레 시연(④) 발표 화면: 손님 주소를 2초마다 불러 응답 환경 · 최근 60건 · 전환을 보인다
    path: '/o/:slug/remote/onprem',
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    lazy: () => import('@/pages/remote/OnpremWatchPage').then((m) => ({ Component: m.default })),
  },
  {
    // 휴대폰에 치기 쉬운 짧은 주소. 로그인 뒤 첫 조직의 충격 트리거로 보낸다
    path: '/remote',
    HydrateFallback: RouteLoading,
    errorElement: <RouteErrorPage />,
    lazy: () =>
      import('@/pages/remote/RemoteShakeRedirect').then((m) => ({ Component: m.default })),
  },
  {
    path: '/o/:slug',
    HydrateFallback: RouteLoading,
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        handle: crumb(k('Dashboard')),
        lazy: () =>
          import('@/pages/dashboard/DashboardPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'services',
        handle: crumb(k('Services')),
        children: [
          {
            index: true,
            lazy: () =>
              import('@/pages/services/ServicesPage').then((m) => ({ Component: m.default })),
          },
          {
            path: ':serviceId',
            handle: crumb(k('Service')),
            children: [
              {
                index: true,
                lazy: () =>
                  import('@/pages/services/ServiceDetailPage').then((m) => ({
                    Component: m.default,
                  })),
              },
              {
                path: 'deploys/:deployRequestId',
                handle: crumb(k('Deploy')),
                lazy: () =>
                  import('@/pages/services/DeployProgressPage').then((m) => ({
                    Component: m.default,
                  })),
              },
            ],
          },
        ],
      },
      {
        path: 'evacuation',
        handle: crumb(k('Evacuation')),
        children: [
          {
            index: true,
            lazy: () =>
              import('@/pages/evacuation/EvacuationPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'pre-check',
            handle: crumb(k('AI pre-check')),
            lazy: () =>
              import('@/pages/evacuation/PrecheckPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'plan',
            handle: crumb(k('Approve plan')),
            lazy: () =>
              import('@/pages/evacuation/PlanPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: 'migrations',
        handle: crumb(k('Migrations')),
        children: [
          {
            index: true,
            lazy: () =>
              import('@/pages/migrations/MigrationsPage').then((m) => ({ Component: m.default })),
          },
          {
            path: ':planId',
            handle: crumb(k('Migration')),
            lazy: () =>
              import('@/pages/migrations/MigrationPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: 'history',
        handle: crumb(k('Disaster history')),
        lazy: () =>
          import('@/pages/history/DisasterHistoryPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'security',
        handle: crumb(k('Security')),
        lazy: () => import('@/pages/security/SecurityPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'audit',
        handle: crumb(k('Audit log')),
        lazy: () => import('@/pages/audit/AuditPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'settings',
        handle: crumb(k('Settings')),
        children: [
          { index: true, element: <Navigate to="environments" replace /> },
          {
            path: 'environments',
            handle: crumb(k('Environments')),
            lazy: () =>
              import('@/pages/settings/EnvironmentsPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'members',
            handle: crumb(k('Members')),
            lazy: () =>
              import('@/pages/settings/MembersPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
      { path: '*', element: <PlaceholderPage title={k('Not found')} /> },
    ],
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/tokens',
          lazy: () => import('@/pages/dev/TokensPage').then((m) => ({ Component: m.default })),
        },
        {
          path: '/dev/disaster-history',
          lazy: () =>
            import('@/pages/dev/DisasterHistoryPreview').then((m) => ({ Component: m.default })),
        },
      ]
    : []),
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
registerPrefetchRoutes(routes);
