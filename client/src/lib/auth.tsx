import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { queryClient } from "./queryClient";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "candidate" | "employer" | "admin";
  phone?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  authFetch: (method: string, url: string, data?: unknown) => Promise<Response>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: "candidate" | "employer";
  phone?: string;
  companyName?: string;
  industry?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const authFetch = useCallback(
    async (method: string, url: string, data?: unknown) => {
      const headers: Record<string, string> = {};
      if (data) headers["Content-Type"] = "application/json";
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}${url}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res;
    },
    [token]
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error(err.message || "Login failed");
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (regData: RegisterData) => {
    // Register user
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: regData.email,
        password: regData.password,
        name: regData.name,
        role: regData.role,
        phone: regData.phone || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Registration failed" }));
      throw new Error(err.message || "Registration failed");
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);

    // If employer, create company and employer profile
    if (regData.role === "employer" && regData.companyName) {
      try {
        // Create company
        const companyRes = await fetch(`${API_BASE}/api/employer/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({
            companyName: regData.companyName,
            industry: regData.industry || null,
          }),
        });
        // If setup endpoint doesn't exist, the company was already created during registration
        if (!companyRes.ok) {
          console.log("Employer setup: using default setup");
        }
      } catch {
        // Employer profile may be created by backend automatically
      }
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
