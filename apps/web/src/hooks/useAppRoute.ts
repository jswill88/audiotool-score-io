import { useCallback, useEffect, useState } from 'react';
import type { AudiotoolBrowserAuth } from './useAudiotoolBrowserAuth';

export type AppRoute = '/' | '/sign-in' | '/app' | string;

type NavigateOptions = {
  replace?: boolean;
};

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => normalizeRoute(window.location.pathname));

  const navigate = useCallback((target: AppRoute, options: NavigateOptions = {}) => {
    const normalizedTarget = normalizeRoute(target);
    const current = normalizeRoute(window.location.pathname);

    if (current === normalizedTarget) {
      setRoute(normalizedTarget);
      return;
    }

    if (options.replace) {
      window.history.replaceState(null, '', normalizedTarget);
    } else {
      window.history.pushState(null, '', normalizedTarget);
    }

    setRoute(normalizedTarget);
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { route, navigate };
}

export function getRedirectTarget(route: AppRoute, auth: AudiotoolBrowserAuth): AppRoute | null {
  if (route !== '/' && route !== '/sign-in' && route !== '/app') {
    return '/';
  }

  if (auth.phase === 'loading') {
    return null;
  }

  if (route === '/') {
    return auth.isAuthenticated ? '/app' : '/sign-in';
  }

  if (route === '/sign-in' && auth.isAuthenticated) {
    return '/app';
  }

  if (route === '/app' && !auth.isAuthenticated) {
    return '/sign-in';
  }

  return null;
}

export function statusMessageForRedirect(
  route: AppRoute,
  redirectTarget: AppRoute,
  auth: AudiotoolBrowserAuth
) {
  if (auth.phase === 'loading') {
    return 'Checking Audiotool session';
  }

  if (route === '/app' && redirectTarget === '/sign-in') {
    return 'Opening sign-in';
  }

  if (redirectTarget === '/app') {
    return 'Opening app';
  }

  return 'Opening sign-in';
}

function normalizeRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/sign-in' || path === '/app' ? path : pathname;
}
