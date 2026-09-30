import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import http from '../api/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await http.get('/auth/me');
      setAdmin(response.data.data.admin);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (credentials) => {
    const response = await http.post('/auth/login', credentials);
    setAdmin(response.data.data.admin);
    return response.data.data.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout');
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = useMemo(() => ({ admin, loading, login, logout, refreshSession }), [admin, loading, login, logout, refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
