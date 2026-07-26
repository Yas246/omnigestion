/**
 * Auth + company API (AdonisJS backend). Wraps the API client and manages the
 * token / current-company in localStorage. Used by the (rewired) auth context.
 */
import { api, setAuthed, setCompanyId } from './client'
import type { Permission, UserRole } from '@/types'

export interface AuthUser {
  id: number
  email: string
  fullName: string | null
  tenantId: number
  isOwner: boolean
  /** 'admin' for the owner (full access), 'employee' otherwise. */
  role: UserRole
  /** Granular permissions for the current company (empty for the owner, who is
   *  treated as admin client-side). Resolved by /account/profile. */
  permissions: Permission[]
}

export interface Company {
  id: number
  name: string
  slogan: string | null
  description: string | null
  businessSector: string | null
  currency: string
  taxId: string | null
  ifu: string | null
  rccm: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  logoUrl: string | null
  invoiceFooter: string | null
  createdAt: string
  updatedAt: string | null
}

export interface LoginResponse {
  user: AuthUser
}

export interface RegisterInput {
  fullName: string | null
  email: string
  password: string
  passwordConfirmation: string
  companyName: string
}

export interface RegisterResponse {
  user: AuthUser
  company: Company
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', { email, password })
  setAuthed(true) // presence cookie — the real token is the HttpOnly cookie set by the backend
  return res
}

export async function register(data: RegisterInput): Promise<RegisterResponse> {
  const res = await api.post<RegisterResponse>('/auth/signup', data)
  setAuthed(true)
  setCompanyId(res.company.id) // new tenant's first company selected by default
  return res
}

export async function fetchProfile(): Promise<AuthUser> {
  return api.get<AuthUser>('/account/profile')
}

export async function logout(): Promise<void> {
  try {
    await api.post('/account/logout')
  } catch {
    // Backend may already be unreachable / token revoked — clear locally regardless.
  }
  setAuthed(false)
}

export async function listCompanies(): Promise<Company[]> {
  return api.get<Company[]>('/companies')
}

export async function createCompany(data: Partial<Company> & { name: string }): Promise<Company> {
  return api.post<Company>('/companies', data)
}
