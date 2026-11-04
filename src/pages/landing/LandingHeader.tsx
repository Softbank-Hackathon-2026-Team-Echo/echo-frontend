import { Link } from 'react-router';
import { LanguageMenu } from '@/components/LanguageMenu';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { githubLoginUrl } from '@/lib/api/auth';
import { k, t } from '@/lib/i18n';

const NAV = [
  { label: k('Product'), href: '#product' },
  { label: k('How it works'), href: '#how-it-works' },
  { label: k('Features'), href: '#features' },
  { label: k('Regions'), href: '#regions' },
];

/** L01 상단 바. 로그인은 L01-b, 계정 만들기는 GitHub 로그인(첫 로그인이 곧 가입)이다 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-gutter max-compact:px-gutter-compact">
        <Link to="/" aria-label={t('EchoPort home')}>
          <Logo />
        </Link>
        <nav aria-label={t('Sections')} className="flex items-center gap-8 max-compact:hidden">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-body-medium text-fg-secondary hover:text-fg"
            >
              {t(item.label)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <Button asChild variant="ghost">
            <Link to="/login">{t('Sign in')}</Link>
          </Button>
          {/* 좁은 화면에서는 머리글이 넘치지 않게 뺀다. 로그인이 곧 가입이다 */}
          <Button asChild className="max-sm:hidden">
            <a href={githubLoginUrl('/')}>{t('Create account')}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
