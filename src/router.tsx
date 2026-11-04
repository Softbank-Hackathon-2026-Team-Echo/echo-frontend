import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell, type RouteHandle } from '@/layouts/AppShell';
import { registerPrefetchRoutes } from '@/lib/route-prefetch';
import NotFoundPage from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

function crumb(name: string): RouteHandle {
  return { crumb: name };
}

// 경로 이름은 ui-terms §3 표를 따른다. 화면이 생기면 PlaceholderPage 를 실제 페이지로 바꾼다
const routes: RouteObject[] = [
  {
    path: '/login',
    lazy: () => import('@/pages/login/LoginPage').then((m) => ({ Component: m.default })),
  },
  {
    path: '/',
    lazy: () => import('@/pages/root/RootRedirect').then((m) => ({ Component: m.default })),
  },
  {
    // 온보딩은 사이드바 없이 한 화면을 다 쓴다(Figma O01~O03)
    path: '/o/:slug/onboarding',
    errorElement: <RouteErrorPage />,
    lazy: () => import('@/pages/onboarding/OnboardingPage').then((m) => ({ Component: m.default })),
  },
  {
    path: '/o/:slug',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        handle: crumb('Dashboard'),
        lazy: () =>
          import('@/pages/dashboard/DashboardPage').then((m) => ({ Component: m.default })),
      },
      {
        path: 'services',
        handle: crumb('Services'),
        children: [
          {
            index: true,
            lazy: () =>
              import('@/pages/services/ServicesPage').then((m) => ({ Component: m.default })),
          },
          {
            path: ':serviceId',
            handle: crumb('Service'),
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
                handle: crumb('Deploy'),
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
        handle: crumb('Evacuation'),
        children: [
          {
            index: true,
            lazy: () =>
              import('@/pages/evacuation/EvacuationPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'pre-check',
            handle: crumb('AI pre-check'),
            lazy: () =>
              import('@/pages/evacuation/PrecheckPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'plan',
            handle: crumb('Approve plan'),
            lazy: () =>
              import('@/pages/evacuation/PlanPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: 'migrations',
        handle: crumb('Migrations'),
        children: [
          {
            index: true,
            lazy: () =>
              import('@/pages/migrations/MigrationsPage').then((m) => ({ Component: m.default })),
          },
          {
            path: ':planId',
            handle: crumb('Migration'),
            lazy: () =>
              import('@/pages/migrations/MigrationPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
      {
        path: 'security',
        handle: crumb('Security'),
        lazy: () => import('@/pages/security/SecurityPage').then((m) => ({ Component: m.default })),
      },
      { path: 'audit', handle: crumb('Audit log'), element: <PlaceholderPage title="Audit log" /> },
      {
        path: 'settings',
        handle: crumb('Settings'),
        children: [
          { index: true, element: <Navigate to="environments" replace /> },
          {
            path: 'environments',
            handle: crumb('Environments'),
            lazy: () =>
              import('@/pages/settings/EnvironmentsPage').then((m) => ({ Component: m.default })),
          },
          {
            path: 'members',
            handle: crumb('Members'),
            lazy: () =>
              import('@/pages/settings/MembersPage').then((m) => ({ Component: m.default })),
          },
        ],
      },
      { path: '*', element: <PlaceholderPage title="Not found" /> },
    ],
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/tokens',
          lazy: () => import('@/pages/dev/TokensPage').then((m) => ({ Component: m.default })),
        },
      ]
    : []),
  { path: '*', element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routes);
registerPrefetchRoutes(routes);
