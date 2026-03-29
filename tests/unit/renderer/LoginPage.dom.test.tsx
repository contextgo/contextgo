import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loginMock = vi.fn();
const navigateMock = vi.fn();

const translations: Record<string, string> = {
  'login.pageTitle': 'ContextGo - Sign In',
  'login.brand': 'ContextGo',
  'login.subtitle': 'Welcome back, please sign in to your account',
  'login.username': 'Username',
  'login.usernamePlaceholder': 'Enter your username',
  'login.password': 'Password',
  'login.passwordPlaceholder': 'Enter your password',
  'login.rememberMe': 'Remember me',
  'login.submit': 'Sign In',
  'login.submitting': 'Signing in...',
  'login.success': 'Login successful! Redirecting...',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.footerPrimary': 'Transform your command-line AI',
  'login.footerSecondary': 'Modern & Efficient',
  'login.errors.empty': 'Please enter username and password',
  'login.errors.invalidCredentials': 'Invalid username or password',
  'login.errors.tooManyAttempts': 'Too many attempts, please try again later',
  'login.errors.networkError': 'Connection failed, please try again',
  'login.errors.serverError': 'Server error, please try again later',
  'login.errors.unknown': 'Sign-in failed, please try again',
  'login.oauth.title': 'Or continue with',
  'login.oauth.loading': 'Checking sign-in options...',
  'login.oauth.providers.github': 'Continue with GitHub',
  'login.oauth.providers.google': 'Continue with Google',
  'login.oauth.errors.accessDenied': 'Third-party sign-in was cancelled or denied',
  'login.oauth.errors.callbackFailed': 'Third-party sign-in failed. Please try again.',
  'login.oauth.errors.emailNotAllowed': 'This account is not allowed to sign in.',
  'login.oauth.errors.emailRequired': 'A verified email address is required to sign in.',
  'login.oauth.errors.providerUnavailable': 'This sign-in method is not configured.',
  'login.oauth.errors.sessionExpired': 'The sign-in session expired. Please try again.',
  'login.oauth.errors.unknown': 'Third-party sign-in failed. Please try again.',
};

vi.mock('@renderer/assets/logos/brand/app.png', () => ({
  default: '/mock-logo.png',
}));

vi.mock('@renderer/components/layout/AppLoader', () => ({
  default: () => <div>loading...</div>,
}));

vi.mock('../../../src/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    login: loginMock,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../../src/renderer/services/i18n', () => ({
  changeLanguage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
    i18n: {
      language: 'en-US',
    },
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    loginMock.mockReset();
    navigateMock.mockReset();
    localStorage.clear();
    window.history.replaceState({}, '', '/login');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows configured OAuth providers on the login page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          providers: ['github', 'google'],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const { default: LoginPage } = await import('../../../src/renderer/pages/login');
    render(<LoginPage />);

    expect(await screen.findByText('Continue with GitHub')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth/providers', {
      method: 'GET',
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
  });

  it('shows OAuth callback errors returned from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          providers: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/login?oauthError=email_not_allowed');

    const { default: LoginPage } = await import('../../../src/renderer/pages/login');
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('This account is not allowed to sign in.');
    });
  });
});
