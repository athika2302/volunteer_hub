import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vh_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('vh_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Authenticated fetch wrapper
  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      const currentToken = token || localStorage.getItem('vh_token');
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      const fullUrl = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

      const res = await fetch(fullUrl, {
        ...options,
        headers,
      });

      const data = await res.json().catch(() => ({}));

      // If token expired or invalid, auto-logout
      if (res.status === 401) {
        logout();
      }

      if (!res.ok) {
        const error = new Error(data.error || 'Request failed');
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    },
    [token]
  );

  // Verify and refresh user profile on initial load
  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem('vh_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
      localStorage.setItem('vh_user', JSON.stringify(data.user));
    } catch (err) {
      console.warn('[Auth] Failed to refresh user profile:', err.message);
      // If unauthorized, clear session
      if (err.status === 401) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('vh_token');
        localStorage.removeItem('vh_user');
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Login action
  const login = async (phone, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('vh_token', data.token);
    localStorage.setItem('vh_user', JSON.stringify(data.user));
    return data.user;
  };

  // Register action
  const register = async ({ name, phone, password, upiId }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, upiId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('vh_token', data.token);
    localStorage.setItem('vh_user', JSON.stringify(data.user));
    return data;
  };

  // Logout action
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vh_token');
    localStorage.removeItem('vh_user');
  };

  const isAdmin = user?.role === 'admin';
  const isApproved = user?.approved === true;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAdmin,
        isApproved,
        login,
        register,
        logout,
        refreshUser,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

