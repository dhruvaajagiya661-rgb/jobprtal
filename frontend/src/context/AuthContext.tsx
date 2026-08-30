import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../api/client';

interface User {
  id: number;
  email: string;
  username: string;
  is_student: boolean;
  is_recruiter: boolean;
  is_superuser?: boolean;
  profile?: Record<string, unknown>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    email: string;
    password: string;
    username?: string;
    role: 'student' | 'recruiter';
    company_name?: string;
    designation?: string;
  }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isStudent: boolean;
  isRecruiter: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      // Validate the session against the server on app load. The axios
      // interceptor transparently refreshes an expired access token; if the
      // refresh also fails, we clear the stale session so the user is not
      // left "logged in" with an unusable token (the root cause of 401s).
      authAPI
        .me()
        .then((response) => {
          const fresh = response.data as User;
          setUser(fresh);
          localStorage.setItem('user', JSON.stringify(fresh));
        })
        .catch((err) => {
          // Only clear the session on a genuine 401. Network blips, timeouts
          // or 5xx responses shouldn't log the user out.
          const status = err?.response?.status;
          if (status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            setUser(null);
          } else {
            // Keep the stored session; fall back to it so the user isn't
            // falsely logged out due to a transient error.
            try {
              setUser(JSON.parse(storedUser));
            } catch {
              setUser(null);
            }
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await authAPI.login(email, password);
    const { user: userData, access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (data: {
    email: string;
    password: string;
    username?: string;
    role: 'student' | 'recruiter';
    company_name?: string;
    designation?: string;
  }) => {
    // Create the account only — no auto-login. The user is sent to the
    // login page to sign in with their new credentials.
    await authAPI.register(data);
  };

  const logout = () => {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      authAPI.logout(refresh).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isStudent: user?.is_student ?? false,
    isRecruiter: user?.is_recruiter ?? false,
    isAdmin: user?.is_superuser ?? false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
