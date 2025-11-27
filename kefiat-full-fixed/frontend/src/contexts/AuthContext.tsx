import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "tenant" | "manager" | "admin";
} | null;

interface AuthContextValue {
  user: User;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("kefiat_token");
    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);
    api
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("kefiat_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { token: newToken, user: newUser } = res.data;
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("kefiat_token", newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("kefiat_token");
  };

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
