import { useCallback, useEffect, useState } from 'react';
import type { BrowserAuthResult } from '@audiotool/nexus';
import {
  audiotoolAuthConfig,
  formatAudiotoolBrowserAuthError,
  readAudiotoolBrowserAuthSupportError,
  isAudiotoolAuthConfigured
} from '../auth/audiotoolAuth';
import type { ServerAuth } from '../types';

type AuthPhase = 'loading' | 'unconfigured' | 'authenticated' | 'unauthenticated' | 'error';

type AuthState = {
  phase: AuthPhase;
  client: BrowserAuthResult | null;
  error: string;
};

export type AudiotoolBrowserAuth = AuthState & {
  config: typeof audiotoolAuthConfig;
  isAuthenticated: boolean;
  userName: string;
  login: () => Promise<void>;
  logout: () => void;
  exportServerAuth: () => ServerAuth | null;
};

export function useAudiotoolBrowserAuth(): AudiotoolBrowserAuth {
  const [state, setState] = useState<AuthState>(createInitialState);

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      try {
        const nextState = await readAudiotoolAuthState();

        if (!cancelled) {
          setState(nextState);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            phase: 'error',
            client: null,
            error: formatAudiotoolBrowserAuthError(error)
          });
        }
      }
    }

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    const supportError = readAudiotoolBrowserAuthSupportError();

    if (supportError) {
      setState({
        phase: 'error',
        client: null,
        error: supportError
      });
      return;
    }

    try {
      const authState = state.client?.status === 'unauthenticated'
        ? state
        : await readAudiotoolAuthState();

      setState(authState);

      if (authState.client?.status === 'unauthenticated') {
        await authState.client.login();
      }
    } catch (error) {
      setState({
        phase: 'error',
        client: null,
        error: formatAudiotoolBrowserAuthError(error)
      });
    }
  }, [state]);

  const logout = useCallback(() => {
    if (state.client?.status === 'authenticated') {
      state.client.logout();
    }

    setState({
      phase: 'unauthenticated',
      client: null,
      error: ''
    });
  }, [state.client]);

  const exportServerAuth = useCallback(() => {
    if (state.client?.status !== 'authenticated') {
      return null;
    }

    return {
      ...state.client.exportTokens(),
      clientId: audiotoolAuthConfig.clientId
    };
  }, [state.client]);

  return {
    ...state,
    config: audiotoolAuthConfig,
    isAuthenticated: state.phase === 'authenticated',
    userName: state.client?.status === 'authenticated' ? state.client.userName : '',
    login,
    logout,
    exportServerAuth
  };
}

async function readAudiotoolAuthState(): Promise<AuthState> {
  if (!isAudiotoolAuthConfigured()) {
    return {
      phase: 'unconfigured',
      client: null,
      error: 'Set VITE_AUDIOTOOL_CLIENT_ID to enable Audiotool login.'
    };
  }

  const supportError = readAudiotoolBrowserAuthSupportError();

  if (supportError) {
    return {
      phase: 'error',
      client: null,
      error: supportError
    };
  }

  const { audiotool } = await import('@audiotool/nexus');
  const result = await audiotool(audiotoolAuthConfig);

  if (result.status === 'authenticated') {
    return {
      phase: 'authenticated',
      client: result,
      error: ''
    };
  }

  return {
    phase: 'unauthenticated',
    client: result,
    error: result.error?.message ?? ''
  };
}

function createInitialState(): AuthState {
  if (!isAudiotoolAuthConfigured()) {
    return {
      phase: 'unconfigured',
      client: null,
      error: ''
    };
  }

  const supportError = readAudiotoolBrowserAuthSupportError();

  return {
    phase: supportError ? 'error' : 'loading',
    client: null,
    error: supportError
  };
}
