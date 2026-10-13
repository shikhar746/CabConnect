import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthAPI } from '../services/endpoints';
import { setUnauthorizedHandler, tokenStore } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [booting, setBooting] = useState(!!tokenStore.get());
  const [config, setConfig] = useState(null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  useEffect(() => {
    AuthAPI.config().then(({ data }) => setConfig(data)).catch(() => setConfig(null));
  }, []);

  // Restore a stored session once on load. Login/register already return the user,
  // so this must not re-run when the token changes.
  useEffect(() => {
    if (!tokenStore.get()) { setBooting(false); return undefined; }
    let alive = true;
    AuthAPI.me()
      .then(({ data }) => alive && setUser(data))
      // Only an auth failure invalidates the session; a network blip just shows the login page.
      .catch((e) => { if (alive && (e.status === 401 || e.status === 403)) logout(); })
      .finally(() => alive && setBooting(false));
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = useCallback(({ token: t, user: u }) => {
    tokenStore.set(t);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (identifier, password) => startSession((await AuthAPI.login({ identifier, password })).data), [startSession]);
  const register = useCallback(async (body) => startSession((await AuthAPI.register(body)).data), [startSession]);
  const socialLogin = useCallback(async (body) => {
    const { data } = await AuthAPI.social(body);
    startSession(data);
    return data;
  }, [startSession]);

  const refreshUser = useCallback(async () => {
    const { data } = await AuthAPI.me();
    setUser(data);
    return data;
  }, []);

  const value = useMemo(() => ({
    user, token, booting, config, isAuthenticated: !!user,
    login, register, socialLogin, logout, setUser, refreshUser,
  }), [user, token, booting, config, login, register, socialLogin, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

/** Home route for each role. */
export const homeFor = (role) => ({ rider: '/book', driver: '/driver', admin: '/admin' }[role] || '/');
