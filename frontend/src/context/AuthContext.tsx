import React, { createContext, useCallback, useEffect, useState } from 'react';
import { api, TOKEN_KEY } from '../lib/api';
import { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    let active = true;
    async function verifySession() {
      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await api.get<{ user: User }>('/auth/me');
        if (active) {
          setUser(res.data.user);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void verifySession();
    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/login', {
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/register', {
      name,
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout audit network failure
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
