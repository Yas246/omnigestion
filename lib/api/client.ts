/**
 * API client for the Omnigestion backend (AdonisJS).
 *
 * Foundational fetch wrapper used by every rewired frontend module. Handles:
 *  - base URL (NEXT_PUBLIC_API_URL, default http://localhost:3333)
 *  - JWT access token (localStorage) -> Authorization: Bearer
 *  - current company (localStorage)  -> X-Company-Id
 *  - JSON + error normalization (ApiError with status + server message)
 *
 * The auth context owns the token / company id via setToken / setCompanyId.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const TOKEN_KEY = 'omnigestion_token'

/** Backend origin (for media URLs + server-side public fetch). */
export const API_ORIGIN = API_URL
/** Resolve a stored media path (/uploads/...) to an absolute URL. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('http') ? path : `${API_ORIGIN}${path}`
}
const COMPANY_KEY = 'omnigestion_company_id'

export class ApiError extends Error {
  status: number
  body: any
  constructor(message: string, status: number, body: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function readLocal(key: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key)
}

function writeLocal(key: string, value: string | null) {
  if (typeof window === 'undefined') return
  if (value === null) window.localStorage.removeItem(key)
  else window.localStorage.setItem(key, value)
}

export function getToken(): string | null {
  return readLocal(TOKEN_KEY)
}
export function setToken(token: string | null) {
  writeLocal(TOKEN_KEY, token)
  // Sync a presence cookie so the Next.js middleware can do server-side route
  // protection (the token itself stays in localStorage + Authorization header).
  if (typeof document !== 'undefined') {
    document.cookie = token
      ? 'omnigestion-auth=1; path=/; max-age=604800; SameSite=Lax'
      : 'omnigestion-auth=; path=/; max-age=0; SameSite=Lax'
  }
}
export function getCompanyId(): number | null {
  const raw = readLocal(COMPANY_KEY)
  return raw ? Number(raw) : null
}
export function setCompanyId(id: number | null) {
  writeLocal(COMPANY_KEY, id === null ? null : String(id))
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const companyId = getCompanyId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (companyId) headers['X-Company-Id'] = String(companyId)

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers })

  // 204 No Content
  if (res.status === 204) return null as T

  const text = await res.text()
  const body = text ? safeJson(text) : null
  if (!res.ok) {
    // Always log the full response so any API failure is diagnosable in the
    // browser console (status + path + body). Without this, a 422 from the
    // VineJS validator ({ errors: [...] }, no top-level message) shows as a
    // generic "Erreur 422" and the faulty field stays hidden.
    console.error(`[API ${res.status}] ${path}`, body)
    const obj = body && typeof body === 'object' ? body : null
    let message =
      obj && (obj.message || obj.error)
        ? obj.message || obj.error
        : null
    if (!message && obj && Array.isArray(obj.errors) && obj.errors.length) {
      // VineJS validation errors → "field: message; field: message"
      message = obj.errors
        .map((e: any) => (e.field ? `${e.field}: ${e.message}` : e.message))
        .join('; ')
    }
    if (!message) message = `Erreur ${res.status}`
    throw new ApiError(message, res.status, body)
  }
  // Paginated responses: { meta, data } — return as-is
  return body as T
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path),
  post: <T = any>(path: string, data?: any) =>
    apiFetch<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T = any>(path: string, data?: any) =>
    apiFetch<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T = any>(path: string, data?: any) =>
    apiFetch<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T = any>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
