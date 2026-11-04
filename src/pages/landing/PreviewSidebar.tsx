import {
  ArrowLeftRight,
  History,
  LayoutDashboard,
  MapPin,
  Server,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Logo } from '@/components/Logo';
import { k, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type NavItem = { label: string; icon: ComponentType<{ className?: string }>; count?: number };

const GROUPS: { title?: string; items: NavItem[] }[] = [
  { items: [{ label: k('Dashboard'), icon: LayoutDashboard, count: 2 }] },
  { title: k('Operate'), items: [{ label: k('Services'), icon: Server }] },
  {
    title: k('Resilience'),
    items: [
      { label: k('Evacuation'), icon: MapPin },
      { label: k('Migrations'), icon: ArrowLeftRight },
    ],
  },
  {
    title: k('Govern'),
    items: [
      { label: k('Security'), icon: ShieldCheck },
      { label: k('Audit log'), icon: History },
    ],
  },
];

/** 제품 화면 그림의 사이드바. 앱 AppShell 의 묶음 메뉴를 같은 모양으로 그린다 */
export function PreviewSidebar() {
  return (
    <div className="flex w-48 shrink-0 flex-col gap-4 border-r border-line bg-surface p-3 max-compact:hidden">
      <div className="px-2 py-1">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-3">
        {GROUPS.map((group) => (
          <div key={group.title ?? 'top'} className="flex flex-col gap-0.5">
            {group.title && (
              <span className="px-2 pb-1 text-overline text-fg-muted uppercase">
                {t(group.title)}
              </span>
            )}
            {group.items.map(({ label, icon: Icon, count }, index) => (
              <span
                key={label}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-body',
                  group.title === undefined && index === 0
                    ? 'bg-brand-subtle text-brand-on-subtle'
                    : 'text-fg-secondary',
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{t(label)}</span>
                {count !== undefined && (
                  <span className="rounded-full bg-danger-solid px-1.5 text-caption text-fg-on-brand">
                    {count}
                  </span>
                )}
              </span>
            ))}
          </div>
        ))}
      </nav>
      <span className="flex items-center gap-2 px-2 text-body text-fg-secondary">
        <Settings className="size-4" />
        {t('Settings')}
      </span>
      <span className="flex items-center gap-2 px-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-subtle text-label text-brand-on-subtle">
          EP
        </span>
        <span className="flex flex-col">
          <span className="text-body-medium">echoport</span>
          <span className="text-caption text-fg-muted">{t('Admin')}</span>
        </span>
      </span>
    </div>
  );
}
