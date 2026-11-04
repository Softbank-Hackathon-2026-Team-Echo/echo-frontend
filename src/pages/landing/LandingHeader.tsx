import { Link } from 'react-router';
import { LanguageMenu } from '@/components/LanguageMenu';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { githubLoginUrl } from '@/lib/api/auth';

const NAV = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Regions', href: '#regions' },
];

/** L01 상단 바. 로그인은 L01-b, 계정 만들기는 GitHub 로그인(첫 로그인이 곧 가입)이다 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-gutter max-compact:px-gutter-compact">
        <Link to="/" aria-label="EchoPort home">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="flex items-center gap-8 max-compact:hidden">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-body-medium text-fg-secondary hover:text-fg"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <a href={githubLoginUrl('/')}>Create account</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
