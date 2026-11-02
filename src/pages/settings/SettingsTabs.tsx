import { NavLink } from 'react-router';

const TABS = [
  { to: '../environments', label: 'Environments' },
  { to: '../members', label: 'Members' },
];

/** SET 설정의 탭 (와이어프레임: Environments · Members). 탭마다 주소가 있다 */
export function SettingsTabs() {
  return (
    <nav aria-label="Settings" className="flex w-fit gap-1 rounded-lg bg-subtle p-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.to}
          relative="path"
          className="rounded-md px-3 py-1 text-body-medium text-fg-secondary hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-xs"
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
