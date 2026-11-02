import {
  ArrowLeftRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  Projector,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useParams,
} from 'react-router';
import { DisasterDialog } from '@/components/disaster/DisasterDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { MockDataBadge } from '@/components/MockDataBadge';
import { RoleButton } from '@/components/RoleButton';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type Theme, useTheme } from '@/hooks/useTheme';
import { useLogout } from '@/lib/api/auth';
import { useActiveDisasters } from '@/lib/api/disasters';
import { useCurrentOrg } from '@/lib/api/me';
import type { Organization, User } from '@/lib/api/types';
import { roleLabel } from '@/lib/roles';

// 와이어프레임 v2 사이드바: 대시보드 + 묶음 3개, 설정은 아래 (노션 IA 1절)
const NAV_GROUPS = [
  { label: 'Operate', items: [{ to: 'services', label: 'Services', icon: Server }] },
  {
    label: 'Resilience',
    items: [
      { to: 'evacuation', label: 'Evacuation', icon: MapPin },
      { to: 'migrations', label: 'Migrations', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Govern',
    items: [
      { to: 'security', label: 'Security', icon: ShieldCheck },
      { to: 'audit', label: 'Audit log', icon: History },
    ],
  },
] as const;

const THEME_ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, projector: Projector };
const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  projector: 'Projector',
};

export type RouteHandle = { crumb?: string };

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: typeof Sun;
  end?: boolean;
  badge?: number;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* TooltipTrigger(asChild)는 className 을 문자열로 합치므로 함수형 className 대신 aria-current 로 활성 상태를 그린다 */}
        <NavLink
          to={to}
          end={end}
          className="relative flex h-9 items-center gap-3 rounded-md px-3 text-body-medium text-fg-secondary transition-colors hover:bg-subtle hover:text-fg aria-[current=page]:bg-brand-subtle aria-[current=page]:text-brand-on-subtle max-compact:justify-center max-compact:px-0"
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="flex-1 truncate max-compact:sr-only">{label}</span>
          {badge ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-solid px-1.5 text-caption text-fg-on-brand max-compact:absolute max-compact:top-0 max-compact:right-1 max-compact:h-4 max-compact:min-w-4 max-compact:px-1">
              {badge}
            </span>
          ) : null}
        </NavLink>
      </TooltipTrigger>
      {/* 접힌 사이드바(1024px 미만)에서만 이름을 툴팁으로 보여 준다 */}
      <TooltipContent side="right" className="compact:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** 사이드바 아래 사용자. 눌러서 테마 · 로그아웃 */
function UserMenu({ user, organization }: { user: User; organization: Organization }) {
  const { theme, setTheme, themes } = useTheme();
  const logout = useLogout();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-subtle max-compact:justify-center max-compact:px-0"
        >
          <Avatar className="size-8">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="bg-brand-subtle text-label text-brand-on-subtle">
              {user.githubLogin.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col max-compact:sr-only">
            <span className="truncate text-body-medium">{user.githubLogin}</span>
            <span className="text-caption text-fg-muted">{roleLabel(organization.role)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {themes.map((name) => {
          const ItemIcon = THEME_ICONS[name];
          return (
            <DropdownMenuItem key={name} onSelect={() => setTheme(name)}>
              <ItemIcon aria-hidden />
              <span className="flex-1">{THEME_LABELS[name]}</span>
              {name === theme && <Check aria-hidden />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Sidebar({
  user,
  organization,
  atRiskCount,
}: {
  user: User;
  organization: Organization;
  atRiskCount: number;
}) {
  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-line bg-surface max-compact:w-sidebar-collapsed">
      <div className="flex h-16 items-center px-5 max-compact:justify-center max-compact:px-0">
        <Link to={`/o/${organization.slug}`} aria-label="EchoPort home">
          <Logo className="max-compact:hidden" />
          <Logo variant="app-icon" className="compact:hidden" />
        </Link>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
        <NavItem to="" label="Dashboard" icon={LayoutDashboard} end badge={atRiskCount} />
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1 pt-3">
            <span className="px-3 pb-1 text-overline uppercase text-fg-muted max-compact:sr-only">
              {group.label}
            </span>
            {group.items.map((item) => (
              <NavItem key={item.label} {...item} />
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-1 p-3">
        <NavItem to="settings" label="Settings" icon={Settings} />
        <UserMenu user={user} organization={organization} />
      </div>
    </aside>
  );
}

function Breadcrumb() {
  const matches = useMatches();
  const crumbs = matches
    .map((match) => (match.handle as RouteHandle | undefined)?.crumb)
    .filter((crumb): crumb is string => Boolean(crumb));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-body">
      {crumbs.map((crumb, index) => (
        <span key={crumb} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-fg-muted" />}
          <span className={index === crumbs.length - 1 ? 'text-fg' : 'text-fg-muted'}>{crumb}</span>
        </span>
      ))}
    </nav>
  );
}

function OrgSwitcher({
  organizations,
  current,
}: {
  organizations: Organization[];
  current: Organization;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // 조직을 바꿔도 같은 메뉴에 머문다
  const subPath = pathname.replace(/^\/o\/[^/]+/, '');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-48 justify-between max-compact:w-auto">
          <span className="truncate">
            <span className="text-fg-muted max-compact:hidden">Org · </span>
            {current.name}
          </span>
          <ChevronDown aria-hidden className="text-fg-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} onSelect={() => navigate(`/o/${org.slug}${subPath}`)}>
            <span className="flex-1 truncate">{org.name}</span>
            {org.personal && <span className="text-caption text-fg-muted">Personal</span>}
            {org.id === current.id && <Check aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Topbar({
  organizations,
  organization,
}: {
  organizations: Organization[];
  organization: Organization;
}) {
  const [disasterOpen, setDisasterOpen] = useState(false);
  return (
    <>
      <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-line bg-surface px-gutter max-compact:px-gutter-compact">
        <Breadcrumb />
        <div className="ml-auto flex items-center gap-2">
          <MockDataBadge />
          <OrgSwitcher organizations={organizations} current={organization} />
          <RoleButton requires="DEVELOPER" variant="outline" onClick={() => setDisasterOpen(true)}>
            <Zap aria-hidden />
            <span className="max-compact:sr-only">Simulate disaster</span>
          </RoleButton>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell aria-hidden />
          </Button>
        </div>
      </header>
      <DisasterDialog open={disasterOpen} onOpenChange={setDisasterOpen} orgId={organization.id} />
    </>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex h-dvh">
      <div className="w-sidebar border-r border-line bg-surface max-compact:w-sidebar-collapsed" />
      <div className="flex flex-1 flex-col gap-4 p-gutter">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export function AppShell() {
  const { slug } = useParams();
  const { data: me, organization, isPending, isError, error, refetch } = useCurrentOrg(slug);
  const disasters = useActiveDisasters(organization?.id);
  const atRiskCount = new Set(disasters.data?.flatMap((item) => item.affectedEnvironmentIds)).size;

  if (isPending) return <ShellSkeleton />;
  if (isError) {
    return (
      <main className="mx-auto max-w-content p-gutter">
        <ErrorState error={error} onRetry={() => refetch()} />
      </main>
    );
  }
  if (!organization) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-content items-center p-gutter">
        <EmptyState
          className="w-full"
          icon={Server}
          title="Organization not found"
          description={`You are not a member of "${slug}", or it does not exist.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/">Back to organizations</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar user={me.user} organization={organization} atRiskCount={atRiskCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar organizations={me.organizations} organization={organization} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-content flex-col gap-6 p-gutter max-compact:p-gutter-compact">
            <ScreenErrorBoundary>
              <Outlet />
            </ScreenErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
