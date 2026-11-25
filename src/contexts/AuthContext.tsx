import React, { createContext, useCallback, useContext, useState } from 'react';
import { apiFetch, setAuthToken } from '../services/apiClient';
import type { UserProfile } from '../types/stadium';

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (fullName: string, email: string, password: string) => Promise<UserProfile>;
  adminLogin: (passcode: string) => Promise<UserProfile>;
  adminBootstrap: (fullName: string, email: string, passcode: string) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep user & Bearer token strictly in React memory (never localStorage/sessionStorage)
  const [user, setUser] = useState<UserProfile | null>(null);

  const applySession = useCallback((u: UserProfile, token: string) => {
    setAuthToken(token);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      applySession(res.user, res.token);
      return res.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const res = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      });
      applySession(res.user, res.token);
      return res.user;
    },
    [applySession],
  );

  const adminLogin = useCallback(
    async (passcode: string) => {
      const res = await apiFetch<{ user: UserProfile; token: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
      applySession(res.user, res.token);
      return res.user;
    },
    [applySession],
  );

  const adminBootstrap = useCallback(
    async (fullName: string, email: string, passcode: string) => {
      const res = await apiFetch<{ user: UserProfile; token: string }>('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, passcode }),
      });
      applySession(res.user, res.token);
      return res.user;
    },
    [applySession],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === 'admin',
        login,
        register,
        adminLogin,
        adminBootstrap,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
