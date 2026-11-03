import { Link } from 'react-router';
import { Logo } from '@/components/Logo';

const CONTACT_EMAIL = 'echoport@example.com';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', to: '#product' },
      { label: 'Evacuation', to: '#how-it-works' },
      { label: 'Security', to: '#features' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'API', href: 'https://api.echoport.uk/docs' },
      { label: 'GitHub', href: 'https://github.com/Softbank-Hackathon-2026-Team-Echo' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
    ],
  },
];

const LINK_CLASS = 'text-body text-fg-secondary hover:text-fg';

/** L01 바닥글 */
export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-content flex-wrap justify-between gap-10 px-gutter py-12 max-compact:px-gutter-compact">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-body text-fg-secondary">
            Beyond Lock-In — frictionless cloud management across platforms.
          </p>
          <p className="font-mono text-mono text-fg-muted">Team Echo · SoftBank Hackathon 2026</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-12">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-2">
              <h2 className="text-title">{column.title}</h2>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {'href' in link ? (
                      <a href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </a>
                    ) : link.to.startsWith('#') ? (
                      <a href={link.to} className={LINK_CLASS}>
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
