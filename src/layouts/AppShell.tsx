import {
  ArrowLeftRight,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronsUpDown,
  FileClock,
  LayoutDashboard,
  LogOut,
  Moon,
  Projector,
  Route,
  Settings,
  ShieldCheck,
  Siren,
  Sun,
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
import { DisasterBanner } from '@/components/disaster/DisasterBanner';
import { DisasterDialog } from '@/components/disaster/DisasterDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Logo } from '@/components/Logo';
import { MockDataBadge } from '@/components/MockDataBadge';
import { RoleButton } from '@/components/RoleButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type Theme, useTheme } from '@/hooks/useTheme';
import { useLogout } from '@/lib/api/auth';
import { useCurrentOrg } from '@/lib/api/me';
import type { Organization, User } from '@/lib/api/types';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'services', label: 'Services', icon: Boxes },
  { to: 'evacuation', label: 'Evacuation', icon: Route },
  { to: 'migrations', label: 'Migrations', icon: ArrowLeftRight },
  { to: 'security', label: 'Security', icon: ShieldCheck },
  { to: 'audit', label: 'Audit log', icon: FileClock },
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
}: {
  to: string;
  label: string;
  icon: typeof Sun;
  end?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* TooltipTrigger(asChild)는 className 을 문자열로 합치므로 함수형 className 대신 aria-current 로 활성 상태를 그린다 */}
        <NavLink
          to={to}
          end={end}
          className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-body-medium text-fg-secondary transition-colors hover:bg-subtle hover:text-fg aria-[current=page]:bg-brand-subtle aria-[current=page]:text-brand-on-subtle max-compact:justify-center max-compact:px-0"
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="truncate max-compact:sr-only">{label}</span>
        </NavLink>
      </TooltipTrigger>
      {/* 접힌 사이드바(1024px 미만)에서만 이름을 툴팁으로 보여 준다 */}
      <TooltipContent side="right" className="compact:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function UserBox({ user, organization }: { user: User; organization: Organization }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 max-compact:justify-center max-compact:px-0">
      <Avatar className="size-7">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
        <AvatarFallback className="bg-brand-subtle text-label text-brand-on-subtle">
          {user.githubLogin.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col max-compact:sr-only">
        <span className="truncate text-body-medium">{user.githubLogin}</span>
        <span className="text-caption text-fg-muted">{roleLabel(organization.role)}</span>
      </div>
    </div>
  );
}

function Sidebar({ user, organization }: { user: User; organization: Organization }) {
  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-line bg-surface max-compact:w-sidebar-collapsed">
      <div className="flex h-topbar items-center px-4 max-compact:justify-center max-compact:px-0">
        <Link to={`/o/${organization.slug}`} aria-label="EchoPort home">
          <Logo className="max-compact:[&>span:last-child]:sr-only" />
        </Link>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} {...item} />
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-line p-2">
        <NavItem to="settings" label="Settings" icon={Settings} />
        <UserBox user={user} organization={organization} />
      </div>
    </aside>
  );
}

function Breadcrumb({ organization }: { organization: Organization }) {
  const matches = useMatches();
  const crumbs = matches
    .map((match) => (match.handle as RouteHandle | undefined)?.crumb)
    .filter((crumb): crumb is string => Boolean(crumb));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-body">
      <span className="truncate text-fg-muted">{organization.name}</span>
      {crumbs.map((crumb, index) => (
        <span key={crumb} className="flex items-center gap-1.5">
          <span aria-hidden className="text-fg-muted">
            /
          </span>
          <span className={cn(index === crumbs.length - 1 ? 'text-body-medium' : 'text-fg-muted')}>
            {crumb}
          </span>
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
        <Button variant="outline" size="sm" className="max-w-48">
          <Building2 aria-hidden />
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown aria-hidden className="text-fg-muted" />
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

function ThemeMenu() {
  const { theme, setTheme, themes } = useTheme();
  const Icon = THEME_ICONS[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
  const logout = useLogout();
  const [disasterOpen, setDisasterOpen] = useState(false);
  return (
    <>
      <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-line bg-surface px-gutter max-compact:px-gutter-compact">
        <Breadcrumb organization={organization} />
        <div className="ml-auto flex items-center gap-2">
          <MockDataBadge />
          <OrgSwitcher organizations={organizations} current={organization} />
          <RoleButton
            requires="DEVELOPER"
            size="sm"
            variant="destructive"
            onClick={() => setDisasterOpen(true)}
          >
            <Siren aria-hidden />
            <span className="max-compact:sr-only">Simulate disaster</span>
          </RoleButton>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell aria-hidden />
          </Button>
          <ThemeMenu />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut aria-hidden />
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
          icon={Building2}
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
      <Sidebar user={me.user} organization={organization} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar organizations={me.organizations} organization={organization} />
        <DisasterBanner orgId={organization.id} orgSlug={organization.slug} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-content flex-col gap-6 p-gutter max-compact:p-gutter-compact">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
