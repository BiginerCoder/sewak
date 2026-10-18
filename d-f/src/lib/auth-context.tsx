"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { loginAction, registerAction, logoutAction } from "@/app/actions";

export type UserRole = "citizen" | "partner" | "admin";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  partnerOrganization?: string | null;
  partnerBadge?: string | null;
  isVerified: boolean;
};

export const DEMO_USERS: Record<UserRole, AuthUser> = {
  citizen: {
    id: 1,
    name: "Meera Sharma",
    email: "meera@sewak.local",
    role: "citizen",
    partnerOrganization: null,
    partnerBadge: null,
    isVerified: true,
  },
  partner: {
    id: 2,
    name: "Jaipur Ward 24 Officer",
    email: "partner.ward24@jaipurmc.org",
    role: "partner",
    partnerOrganization: "Jaipur Municipal Corporation",
    partnerBadge: "Ward 24 Nodal Officer",
    isVerified: true,
  },
  admin: {
    id: 4,
    name: "Sewak Admin",
    email: "admin@sewak.local",
    role: "admin",
    partnerOrganization: "Sewak Platform Operations",
    partnerBadge: "Control User",
    isVerified: true,
  },
};

const DEMO_PASSWORDS: Record<UserRole, string> = {
  citizen: "password123",
  partner: "partner123",
  admin: "admin123",
};

type AuthContextType = {
  user: AuthUser;
  role: UserRole;
  isPartner: boolean;
  isAdmin: boolean;
  isVerifiedPartner: boolean;
  isAuthenticated: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  setUser: (user: AuthUser) => void;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    partnerOrganization?: string;
    partnerBadge?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: DEMO_USERS.citizen,
  role: "citizen",
  isPartner: false,
  isAdmin: false,
  isVerifiedPartner: false,
  isAuthenticated: true,
  switchRole: async () => {},
  setUser: () => {},
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
});

const STORAGE_KEY = "sewak.auth.user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser>(DEMO_USERS.citizen);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as AuthUser;
        if (parsed && parsed.email) {
          setUserState(parsed);
          setIsAuthenticated(true);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await loginAction({ email, password });
      if (!res.ok) {
        return { ok: false, error: res.error || "Login failed" };
      }
      if (res.user) {
        const u: AuthUser = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          partnerOrganization: res.user.partnerOrganization,
          partnerBadge: res.user.partnerBadge,
          isVerified: res.user.isVerified,
        };
        setUserState(u);
        setIsAuthenticated(true);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        } catch {
          // Ignore
        }
        return { ok: true };
      }
      return { ok: false, error: "Login failed" };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error during login";
      return { ok: false, error: msg };
    }
  };

  const register = async (input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    partnerOrganization?: string;
    partnerBadge?: string;
  }) => {
    try {
      const res = await registerAction(input);
      if (!res.ok) {
        return { ok: false, error: res.error || "Registration failed" };
      }
      if (res.user) {
        const u: AuthUser = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          partnerOrganization: res.user.partnerOrganization,
          partnerBadge: res.user.partnerBadge,
          isVerified: res.user.isVerified,
        };
        setUserState(u);
        setIsAuthenticated(true);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        } catch {
          // Ignore
        }
        return { ok: true };
      }
      return { ok: false, error: "Registration failed" };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error during registration";
      return { ok: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await logoutAction();
      setUserState(DEMO_USERS.citizen);
      setIsAuthenticated(false);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    } catch {
      // Ignore
    }
  };

  const switchRole = async (newRole: UserRole) => {
    const demoUser = DEMO_USERS[newRole] || DEMO_USERS.citizen;
    const pwd = DEMO_PASSWORDS[newRole] || "password123";
    // Perform genuine server authentication for this profile
    await login(demoUser.email, pwd);
  };

  const setUser = (newUser: AuthUser) => {
    setUserState(newUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    } catch {
      // Ignore
    }
  };

  const isPartner = user.role === "partner" || user.role === "admin";
  const isAdmin = user.role === "admin";
  const isVerifiedPartner = isPartner && user.isVerified;

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user.role,
        isPartner,
        isAdmin,
        isVerifiedPartner,
        isAuthenticated,
        switchRole,
        setUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
