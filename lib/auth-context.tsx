'use client';

/**
 * Auth context — API-backed (AdonisJS). No Firebase.
 *
 * The user object is shaped like the legacy `AppUser` so existing consumers
 * (login, layout, settings tabs, PermissionGate) keep working: `role` +
 * `permissions` come from `/account/profile` (resolved for the currently
 * selected company), so `usePermissions` / `PermissionGate` enforce granular
 * access client-side. Token + current company live in localStorage
 * (see lib/api/client).
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as authApi from '@/lib/api/auth';
import { getToken, setToken, getCompanyId, setCompanyId } from '@/lib/api/client';
import type { AuthUser, Company as ApiCompany } from '@/lib/api/auth';
import type { User as AppUser, Company, UserRole } from '@/types';

interface AuthContextType {
  user: AppUser | null;
  companies: Company[];
  currentCompany: Company | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    companyName: string,
    firstName: string,
    lastName: string,
    position: string,
    phone: string,
    businessSector: 'commerce' | 'commerce_and_services'
  ) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  createCompany: (companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapCompany(c: ApiCompany): Company {
  return {
    id: String(c.id),
    name: c.name,
    slogan: c.slogan ?? undefined,
    description: c.description ?? undefined,
    businessSector: (c.businessSector as Company['businessSector']) ?? undefined,
    currency: c.currency,
    taxId: c.taxId ?? undefined,
    ifu: c.ifu ?? undefined,
    rccm: c.rccm ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    website: c.website ?? undefined,
    logoUrl: c.logoUrl ?? undefined,
    invoiceFooter: c.invoiceFooter ?? undefined,
    createdAt: new Date(c.createdAt),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
  };
}

function mapUser(u: AuthUser, companies: Company[], currentCompany: Company | null): AppUser {
  const role: UserRole = u.role ?? (u.isOwner ? 'admin' : 'employee');
  return {
    id: String(u.id),
    email: u.email,
    displayName: u.fullName ?? '',
    role,
    companyIds: companies.map((c) => c.id),
    currentCompanyId: currentCompany?.id ?? '',
    permissions: u.permissions ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Selects the company (so the API client sends the right X-Company-Id), then
   * fetches the profile to resolve the user's role + permissions FOR THAT
   * COMPANY. Permissions are company-scoped, so this runs after every company
   * switch (and on login/restore).
   */
  const resolveCurrentCompany = async (comps: Company[], storedId: number | null): Promise<Company | null> => {
    const current = comps.find((c) => c.id === String(storedId ?? '')) ?? comps[0] ?? null;
    if (current) setCompanyId(Number(current.id));
    return current;
  };

  const buildCurrentUser = async (comps: Company[], current: Company | null): Promise<AppUser> => {
    if (current) setCompanyId(Number(current.id));
    const profile = await authApi.fetchProfile();
    setToken(getToken()); // refresh the route-protection cookie (may have expired)
    return mapUser(profile, comps, current);
  };

  // Restore session on mount if a token is present
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const comps = (await authApi.listCompanies()).map(mapCompany);
        setCompanies(comps);
        const current = await resolveCurrentCompany(comps, getCompanyId());
        setCurrentCompany(current);
        setUser(await buildCurrentUser(comps, current));
      } catch (err) {
        // Invalid/expired token — clear and start clean
        setToken(null);
        setCompanyId(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await authApi.login(email, password);
      const comps = (await authApi.listCompanies()).map(mapCompany);
      setCompanies(comps);
      const current = await resolveCurrentCompany(comps, getCompanyId());
      setCurrentCompany(current);
      setUser(await buildCurrentUser(comps, current));
    } catch (err: any) {
      const message = err?.status === 401 || err?.status === 400
        ? 'Email ou mot de passe incorrect'
        : err?.message || 'Erreur lors de la connexion';
      setError(message);
      throw err;
    }
  };

  const signUp: AuthContextType['signUp'] = async (
    email, password, companyName, firstName, _lastName, _position, _phone, _businessSector
  ) => {
    setError(null);
    try {
      const fullName = [firstName, _lastName].filter(Boolean).join(' ') || null;
      const { company } = await authApi.register({
        fullName,
        email,
        password,
        passwordConfirmation: password,
        companyName,
      });
      const comps = (await authApi.listCompanies()).map(mapCompany);
      setCompanies(comps);
      const current = comps.find((c) => c.id === String(company.id)) ?? comps[0] ?? null;
      setCurrentCompany(current);
      setUser(await buildCurrentUser(comps, current));
    } catch (err: any) {
      const message = err?.message || 'Erreur lors de l\'inscription';
      setError(message);
      throw err;
    }
  };

  const switchCompany = async (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return;
    setCurrentCompany(company);
    setCompanyId(Number(company.id));
    // Re-resolve permissions for the newly selected company.
    try {
      const profile = await authApi.fetchProfile();
      setUser((prev) => (prev ? mapUser(profile, companies, company) : prev));
    } catch (err: any) {
      console.error('[AuthContext] switchCompany profile fetch failed:', err);
    }
  };

  const createCompany: AuthContextType['createCompany'] = async (companyData) => {
    try {
      const created = await authApi.createCompany({
        name: companyData.name,
        businessSector: companyData.businessSector ?? undefined,
        currency: companyData.currency,
        taxId: companyData.taxId,
        ifu: companyData.ifu,
        rccm: companyData.rccm,
        phone: companyData.phone,
        email: companyData.email,
        address: companyData.address,
      });
      const mapped = mapCompany(created);
      setCompanies((prev) => [...prev, mapped]);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création de l\'entreprise');
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    await authApi.logout();
    setUser(null);
    setCompanies([]);
    setCurrentCompany(null);
  };

  const refreshUser = async () => {
    if (!getToken()) return;
    try {
      const profile = await authApi.fetchProfile();
      setUser((prev) => (prev ? mapUser(profile, companies, currentCompany) : prev));
    } catch (err: any) {
      console.error('[AuthContext] refresh failed:', err);
    }
  };

  /**
   * Re-fetch the companies list + refresh currentCompany in state. Call after a
   * company update (e.g. CompanyTab save) so the new values reflect without a
   * page reload — currentCompany is the source for CompanyTab's form.
   */
  const refreshCompanies = async () => {
    if (!getToken()) return;
    try {
      const comps = (await authApi.listCompanies()).map(mapCompany);
      setCompanies(comps);
      setCurrentCompany((prev) => (prev ? comps.find((c) => c.id === prev.id) ?? prev : prev));
    } catch (err: any) {
      console.error('[AuthContext] refreshCompanies failed:', err);
    }
  };

  const resetPassword = async (_email: string) => {
    // Not yet implemented on the API (no password-reset endpoint). Wire when added.
    setError('La réinitialisation de mot de passe n\'est pas encore disponible sur la nouvelle API.');
    throw new Error('not-implemented');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        switchCompany,
        createCompany,
        refreshUser,
        refreshCompanies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
}
