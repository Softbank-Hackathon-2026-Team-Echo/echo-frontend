import { CircleAlert } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { githubLoginUrl, safeNextPath } from '@/lib/api/auth';
import { describeLoginError } from '@/lib/api/errors';

function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** L01-b 로그인. GitHub 로그인 하나뿐이고, 버튼은 API 로 페이지를 옮긴다 */
export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get('error');
  const next = safeNextPath(searchParams.get('next'));

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-gutter">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center gap-3 text-center">
          <Logo variant="mark" className="size-10" />
          <CardTitle className="text-h2">Sign in to EchoPort</CardTitle>
          <CardDescription>
            Move services across AWS, GCP and on-prem without downtime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorCode && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{describeLoginError(errorCode)}</span>
            </div>
          )}
          <Button asChild size="lg" className="w-full">
            <a href={githubLoginUrl(next)}>
              <GitHubMark />
              Continue with GitHub
            </a>
          </Button>
          <p className="text-center text-small text-fg-muted">
            New accounts start with a personal organization. To join a team, ask an admin to invite
            your GitHub username.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
