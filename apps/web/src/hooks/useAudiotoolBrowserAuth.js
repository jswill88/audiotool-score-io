import { useCallback, useEffect, useState } from 'react';
import {
  audiotoolAuthConfig,
  isAudiotoolAuthConfigured
} from '../auth/audiotoolAuth.js';

const initialState = {
  phase: isAudiotoolAuthConfigured() ? 'loading' : 'unconfigured',
  client: null,
  error: ''
};

export function useAudiotoolBrowserAuth() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      if (!isAudiotoolAuthConfigured()) {
        setState({
          phase: 'unconfigured',
          client: null,
          error: 'Set VITE_AUDIOTOOL_CLIENT_ID to enable Audiotool login.'
        });
        return;
      }

      try {
        const { audiotool } = await import('@audiotool/nexus');
        const result = await audiotool(audiotoolAuthConfig);

        if (cancelled) return;

        if (result.status === 'authenticated') {
          setState({
            phase: 'authenticated',
            client: result,
            error: ''
          });
          return;
        }

        setState({
          phase: 'unauthenticated',
          client: result,
          error: result.error?.message ?? ''
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            phase: 'error',
            client: null,
            error: error.message
          });
        }
      }
    }

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    if (state.client?.status === 'unauthenticated') {
      state.client.login();
    }
  }, [state.client]);

  const logout = useCallback(() => {
    if (state.client?.status === 'authenticated') {
      state.client.logout();
    }
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
