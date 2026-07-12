'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_ORIGIN } from '@/lib/api/client';

interface BuyerAccount {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
}

interface BuyerContextType {
  buyer: BuyerAccount | null;
  signup: (email: string, password: string, fullName?: string, phone?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  authHeader: () => Record<string, string>;
}

const BuyerContext = createContext<BuyerContextType | null>(null);
const TOKEN_KEY = 'storefront-buyer-token';
const ACCOUNT_KEY = 'storefront-buyer-account';

export function BuyerProvider({ children }: { children: React.ReactNode }) {
  const [buyer, setBuyer] = useState<BuyerAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const a = localStorage.getItem(ACCOUNT_KEY);
    if (t && a) {
      setToken(t);
      try { setBuyer(JSON.parse(a)); } catch { /* ignore */ }
    }
  }, []);

  const persist = (tok: string, acct: BuyerAccount) => {
    localStorage.setItem(TOKEN_KEY, tok);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acct));
    setToken(tok);
    setBuyer(acct);
  };

  const signup = useCallback(async (email: string, password: string, fullName?: string, phone?: string) => {
    const res = await fetch(`${API_ORIGIN}/api/v1/public/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phone }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.message || (body.errors?.length ? body.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ') : 'Erreur lors de l\'inscription');
      throw new Error(msg);
    }
    const data = await res.json();
    persist(data.token, data.account);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_ORIGIN}/api/v1/public/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.message || (body.errors?.length ? body.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ') : 'Email ou mot de passe incorrect');
      throw new Error(msg);
    }
    const data = await res.json();
    persist(data.token, data.account);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    setToken(null);
    setBuyer(null);
  }, []);

  const authHeader = useCallback((): Record<string, string> => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  return (
    <BuyerContext.Provider value={{ buyer, signup, login, logout, authHeader }}>
      {children}
    </BuyerContext.Provider>
  );
}

export function useBuyer() {
  const ctx = useContext(BuyerContext);
  if (!ctx) throw new Error('useBuyer must be used within BuyerProvider');
  return ctx;
}
