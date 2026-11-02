import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOGIN_ERROR_MESSAGES, UNKNOWN_LOGIN_ERROR_MESSAGE } from '@/lib/api/errors';
import { renderRoute } from '@/test/render';
import LoginPage from './LoginPage';

function renderLogin(search = '') {
  return renderRoute(<LoginPage />, { path: '/login', url: `/login${search}` });
}

describe('LoginPage', () => {
  it('오류가 없으면 경고를 보여 주지 않는다', async () => {
    renderLogin();

    expect(await screen.findByText('Sign in to EchoPort')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(Object.entries(LOGIN_ERROR_MESSAGES))(
    'error=%s 이면 그 문구를 보여 준다',
    async (code, message) => {
      renderLogin(`?error=${code}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    },
  );

  it('모르는 오류 코드는 일반 문구를 보여 준다', async () => {
    renderLogin('?error=SOMETHING_NEW');

    expect(await screen.findByRole('alert')).toHaveTextContent(UNKNOWN_LOGIN_ERROR_MESSAGE);
  });

  it('GitHub 버튼은 next 를 달고 API 로그인 주소로 이동한다', async () => {
    renderLogin('?next=%2Fo%2Fecho-demo');

    const link = await screen.findByRole('link', { name: /continue with github/i });
    expect(link).toHaveAttribute(
      'href',
      'http://api.test/api/v1/auth/github/login?next=%2Fo%2Fecho-demo',
    );
  });

  it('다른 사이트로 가는 next 는 / 로 바꾼다', async () => {
    renderLogin('?next=%2F%2Fevil.example');

    const link = await screen.findByRole('link', { name: /continue with github/i });
    expect(link).toHaveAttribute('href', 'http://api.test/api/v1/auth/github/login?next=%2F');
  });
});
