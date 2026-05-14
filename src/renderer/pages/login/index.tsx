import { Button, Divider } from '@arco-design/web-react';
import loginLogo from '@renderer/assets/logos/brand/app.png';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CloudAuthProviderId } from '@/common/types/cloud';
import { buildCloudOAuthStartUrl, isContextGoHostname } from '@/common/utils';
import { changeLanguage } from '@/renderer/services/i18n';
import { useNavigate } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { normalizeHashRouteShellHref } from '@renderer/components/layout/routerLocation';
import { resolveAuthenticatedStartupPath, shouldPreferOfficialRemoteShell } from '@renderer/utils/officialRemote';
import { isElectronDesktop, isMobileShellWebView } from '@renderer/utils/platform';
import { useAuth } from '../../hooks/context/AuthContext';
import './LoginPage.css';

type MessageState = {
  type: 'error' | 'success';
  text: string;
};

type OAuthProviderId = 'github' | 'google';

const REMEMBER_ME_KEY = 'rememberMe';
const REMEMBERED_USERNAME_KEY = 'rememberedUsername';
const REMEMBERED_PASSWORD_KEY = 'rememberedPassword';
const OAUTH_PROVIDERS_ENDPOINT = '/api/auth/oauth/providers';
const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);

// Simple obfuscation for stored credentials (not cryptographically secure, but prevents plain text storage)
const obfuscate = (text: string): string => {
  const encoded = btoa(encodeURIComponent(text));
  return encoded.split('').toReversed().join('');
};

const deobfuscate = (text: string): string => {
  try {
    const reversed = text.split('').toReversed().join('');
    return decodeURIComponent(atob(reversed));
  } catch {
    return '';
  }
};

const isOAuthProviderId = (value: unknown): value is OAuthProviderId => value === 'github' || value === 'google';

const renderOAuthIcon = (providerId: OAuthProviderId): React.ReactNode => {
  if (providerId === 'github') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path
          fill='currentColor'
          d='M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.36 6.84 9.72.5.09.68-.22.68-.49 0-.24-.01-1.03-.01-1.87-2.78.62-3.37-1.21-3.37-1.21-.46-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.9c.85 0 1.71.12 2.51.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.42.21 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.58 5.05.36.32.68.94.68 1.89 0 1.36-.01 2.46-.01 2.8 0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z'
        />
      </svg>
    );
  }

  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <path
        fill='#EA4335'
        d='M12.24 10.29v3.92h5.53c-.24 1.27-.96 2.34-2.03 3.06l3.28 2.54c1.92-1.77 3.02-4.38 3.02-7.49 0-.72-.06-1.4-.18-2.06h-9.62Z'
      />
      <path
        fill='#34A853'
        d='M12 22c2.75 0 5.05-.91 6.73-2.45l-3.28-2.54c-.91.61-2.08.97-3.45.97-2.65 0-4.89-1.79-5.69-4.19l-3.38 2.61A10.18 10.18 0 0 0 12 22Z'
      />
      <path
        fill='#4A90E2'
        d='M6.31 13.79A6.1 6.1 0 0 1 6 12c0-.62.11-1.21.31-1.79l-3.38-2.61A10.2 10.2 0 0 0 2 12c0 1.63.39 3.17 1.08 4.4l3.23-2.61Z'
      />
      <path
        fill='#FBBC05'
        d='M12 6.02c1.49 0 2.82.51 3.87 1.5l2.9-2.9C17.04 2.98 14.75 2 12 2a10.18 10.18 0 0 0-8.91 5.6l3.38 2.61C7.11 7.81 9.35 6.02 12 6.02Z'
      />
    </svg>
  );
};

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { status, login } = useAuth();
  const isMobileShellRuntime = typeof window !== 'undefined' && isMobileShellWebView();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProviderId[]>([]);
  const [oauthProvidersLoading, setOauthProvidersLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const messageTimer = useRef<number | undefined>(undefined);

  const isCloudRemoteLogin = useMemo(() => {
    if (isDesktopRuntime || typeof window === 'undefined') {
      return false;
    }

    return isContextGoHostname(window.location.hostname);
  }, []);

  const startupPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return '/guid';
    }

    return resolveAuthenticatedStartupPath({
      activeTabId: null,
      openTabIds: [],
      preferOfficialRemoteShell: shouldPreferOfficialRemoteShell({
        currentHref: window.location.href,
        isDesktopRuntime: isElectronDesktop(),
        isMobileShellRuntime,
      }),
      isMobileShellRuntime,
    });
  }, [isMobileShellRuntime]);

  useEffect(() => {
    document.body.classList.add('login-page-active');
    return () => {
      document.body.classList.remove('login-page-active');
      if (messageTimer.current) {
        window.clearTimeout(messageTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    document.title = t('login.pageTitle');
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    const isRememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    if (isRememberMe) {
      const storedUsername = localStorage.getItem(REMEMBERED_USERNAME_KEY);
      const storedPassword = localStorage.getItem(REMEMBERED_PASSWORD_KEY);
      if (storedUsername) setUsername(deobfuscate(storedUsername));
      if (storedPassword) setPassword(deobfuscate(storedPassword));
      setRememberMe(true);
    }
    if (!isCloudRemoteLogin) {
      window.setTimeout(() => {
        usernameRef.current?.focus();
      }, 0);
    }

    return () => {
      if (messageTimer.current) {
        window.clearTimeout(messageTimer.current);
      }
    };
  }, [isCloudRemoteLogin]);

  useEffect(() => {
    if (status === 'authenticated') {
      void navigate(startupPath, { replace: true });
    }
  }, [navigate, startupPath, status]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const controller = new AbortController();
    setOauthProvidersLoading(true);

    fetch(OAUTH_PROVIDERS_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setOauthProviders([]);
          return;
        }

        const data = (await response.json()) as {
          success: boolean;
          providers?: unknown[];
        };

        if (!data.success || !Array.isArray(data.providers)) {
          setOauthProviders([]);
          return;
        }

        setOauthProviders(data.providers.filter(isOAuthProviderId));
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          console.error('Failed to load OAuth providers:', error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setOauthProvidersLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  const clearMessageLater = useCallback(() => {
    if (messageTimer.current) {
      window.clearTimeout(messageTimer.current);
    }
    messageTimer.current = window.setTimeout(() => {
      setMessage((prev) => (prev?.type === 'success' ? prev : null));
    }, 5000);
  }, []);

  const showMessage = useCallback(
    (next: MessageState) => {
      setMessage(next);
      if (next.type === 'error') {
        clearMessageLater();
      }
    },
    [clearMessageLater]
  );

  const getOAuthErrorMessage = useCallback(
    (code: string): string => {
      switch (code) {
        case 'access_denied':
          return t('login.oauth.errors.accessDenied');
        case 'email_not_allowed':
          return t('login.oauth.errors.emailNotAllowed');
        case 'email_required':
          return t('login.oauth.errors.emailRequired');
        case 'invalid_state':
          return t('login.oauth.errors.sessionExpired');
        case 'provider_not_enabled':
          return t('login.oauth.errors.providerUnavailable');
        case 'missing_code':
        case 'callback_failed':
          return t('login.oauth.errors.callbackFailed');
        default:
          return t('login.oauth.errors.unknown');
      }
    },
    [t]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const oauthError = searchParams.get('oauthError');
    if (!oauthError) {
      return;
    }

    showMessage({
      type: 'error',
      text: getOAuthErrorMessage(oauthError),
    });

    searchParams.delete('oauthError');
    const nextSearch = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, [getOAuthErrorMessage, showMessage]);

  const supportedLanguages = useMemo<{ code: string; label: string }[]>(
    () => [
      { code: 'zh-CN', label: '简体中文' },
      { code: 'zh-TW', label: '繁體中文' },
      { code: 'ja-JP', label: '日本語' },
      { code: 'ko-KR', label: '한국어' },
      { code: 'tr-TR', label: 'Türkçe' },
      { code: 'en-US', label: 'English' },
    ],
    []
  );

  const handleLanguageChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;
    changeLanguage(nextLanguage).catch((error: Error) => {
      console.error('Failed to change language:', error);
    });
  }, []);

  const handleOAuthLogin = useCallback((providerId: OAuthProviderId) => {
    window.location.assign(`/api/auth/oauth/${providerId}/start`);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmedUsername = username.trim();

      if (!trimmedUsername || !password) {
        showMessage({ type: 'error', text: t('login.errors.empty') });
        return;
      }

      setLoading(true);
      setMessage(null);

      const result = await login({ username: trimmedUsername, password, remember: rememberMe });

      if (result.success) {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, 'true');
          localStorage.setItem(REMEMBERED_USERNAME_KEY, obfuscate(trimmedUsername));
          localStorage.setItem(REMEMBERED_PASSWORD_KEY, obfuscate(password));
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
          localStorage.removeItem(REMEMBERED_USERNAME_KEY);
          localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
        }

        const successText = t('login.success');
        showMessage({ type: 'success', text: successText });

        window.setTimeout(() => {
          void navigate(startupPath, { replace: true });
        }, 600);
      } else {
        const errorText = (() => {
          switch (result.code) {
            case 'invalidCredentials':
              return t('login.errors.invalidCredentials');
            case 'tooManyAttempts':
              return t('login.errors.tooManyAttempts');
            case 'networkError':
              return t('login.errors.networkError');
            case 'serverError':
              return t('login.errors.serverError');
            case 'unknown':
            default:
              return result.message ?? t('login.errors.unknown');
          }
        })();

        showMessage({ type: 'error', text: errorText });
      }

      setLoading(false);
    },
    [login, navigate, password, rememberMe, showMessage, startupPath, t, username]
  );

  const handleCloudLogin = useCallback((provider: CloudAuthProviderId) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.href = buildCloudOAuthStartUrl(provider, normalizeHashRouteShellHref(window.location.href));
  }, []);

  if (status === 'checking') {
    return <AppLoader />;
  }

  return (
    <div className='login-page'>
      {/* <div className='login-page__background' aria-hidden='true'>
        <div className='login-page__background-circle login-page__background-circle--lg' />
        <div className='login-page__background-circle login-page__background-circle--md' />
        <div className='login-page__background-circle login-page__background-circle--sm' />
      </div> */}

      <div className='login-page__card'>
        <label className='login-page__lang-select-wrapper' htmlFor='lang-select'>
          <select
            id='lang-select'
            className='login-page__lang-select'
            value={i18n.language}
            onChange={handleLanguageChange}
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>

        <div className='login-page__header'>
          <div className='login-page__logo'>
            <img src={loginLogo} alt={t('login.brand')} />
          </div>
          <h1 className='login-page__title'>{t('login.brand')}</h1>
          <p className='login-page__subtitle'>
            {isCloudRemoteLogin ? t('settings.cloud.description') : t('login.recoverySubtitle')}
          </p>
        </div>

        {isCloudRemoteLogin ? (
          <div className='login-page__cloud-actions'>
            <button
              type='button'
              className='login-page__submit login-page__submit--cloud'
              onClick={() => handleCloudLogin('github')}
            >
              <span>{t('settings.cloud.loginWithGithub')}</span>
            </button>
            <button
              type='button'
              className='login-page__submit login-page__submit--cloud login-page__submit--cloud-secondary'
              onClick={() => handleCloudLogin('google')}
            >
              <span>{t('settings.cloud.loginWithGoogle')}</span>
            </button>
          </div>
        ) : (
          <form className='login-page__form' onSubmit={handleSubmit}>
            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='username'>
                {t('login.username')}
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                  <circle cx='12' cy='7' r='4' />
                </svg>
                <input
                  ref={usernameRef}
                  id='username'
                  name='username'
                  className='login-page__input'
                  placeholder={t('login.usernamePlaceholder')}
                  autoComplete='username'
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-required='true'
                />
              </div>
            </div>

            <div className='login-page__form-item'>
              <label className='login-page__label' htmlFor='password'>
                {t('login.password')}
              </label>
              <div className='login-page__input-wrapper'>
                <svg
                  className='login-page__input-icon'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  aria-hidden='true'
                >
                  <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
                  <path d='M7 11V7a5 5 0 0 1 10 0v4' />
                </svg>
                <input
                  ref={passwordRef}
                  id='password'
                  name='password'
                  type={passwordVisible ? 'text' : 'password'}
                  className='login-page__input'
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete='current-password'
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-required='true'
                />
                <button
                  type='button'
                  className='login-page__toggle-password'
                  onClick={() => setPasswordVisible((prev) => !prev)}
                  aria-label={passwordVisible ? t('login.hidePassword') : t('login.showPassword')}
                >
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                    {passwordVisible ? (
                      <>
                        <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
                        <line x1='1' y1='1' x2='23' y2='23' />
                      </>
                    ) : (
                      <>
                        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
                        <circle cx='12' cy='12' r='3' />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className='login-page__checkbox'>
              <input
                type='checkbox'
                id='remember-me'
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <label htmlFor='remember-me'>{t('login.rememberMe')}</label>
            </div>

            <button type='submit' className='login-page__submit' disabled={loading}>
              {loading && (
                <svg className='login-page__spinner' viewBox='0 0 24 24' width='18' height='18'>
                  <circle
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='3'
                    fill='none'
                    strokeDasharray='50'
                    strokeDashoffset='25'
                    strokeLinecap='round'
                  />
                </svg>
              )}
              <span>{loading ? t('login.submitting') : t('login.submit')}</span>
            </button>

            {(oauthProvidersLoading || oauthProviders.length > 0) && (
              <div className='login-page__oauth-section'>
                <Divider className='login-page__oauth-divider'>{t('login.oauth.title')}</Divider>

                {oauthProvidersLoading ? (
                  <div className='login-page__oauth-loading'>{t('login.oauth.loading')}</div>
                ) : (
                  <div className='login-page__oauth-actions'>
                    {oauthProviders.map((providerId) => (
                      <Button
                        key={providerId}
                        long
                        type='secondary'
                        className='login-page__oauth-button'
                        icon={renderOAuthIcon(providerId)}
                        onClick={() => handleOAuthLogin(providerId)}
                      >
                        {providerId === 'github'
                          ? t('login.oauth.providers.github')
                          : t('login.oauth.providers.google')}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div
              role='alert'
              aria-live='polite'
              className={`login-page__message ${message ? 'login-page__message--visible' : ''} ${message ? (message.type === 'success' ? 'login-page__message--success' : 'login-page__message--error') : ''}`}
              hidden={!message}
            >
              {message?.text}
            </div>
          </form>
        )}

        <div className='login-page__footer'>
          <div className='login-page__footer-content'>
            <span>{t('login.footerPrimary')}</span>
            <span className='login-page__footer-divider'>•</span>
            <span>{t('login.footerSecondary')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
