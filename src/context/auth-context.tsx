"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

interface AuthUser {
  userId: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, username: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("hazelnut_token");
    const storedUser = localStorage.getItem("hazelnut_user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    (token: string, username: string, userId: string) => {
      const userData = { userId, username };
      localStorage.setItem("hazelnut_token", token);
      localStorage.setItem("hazelnut_user", JSON.stringify(userData));
      setToken(token);
      setUser(userData);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("hazelnut_token");
    localStorage.removeItem("hazelnut_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
