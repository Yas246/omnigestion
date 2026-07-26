/**
 * API client for the Omnigestion backend (AdonisJS).
 *
 * Foundational fetch wrapper used by every rewired frontend module. Handles:
 *  - base URL (NEXT_PUBLIC_API_URL, default http://localhost:3333)
 *  - auth via HttpOnly cookie (credentials:'include') — no JS-accessible token
 *  - current company (localStorage)  -> X-Company-Id
 *  - JSON + error normalization (ApiError with status + server message)
 *
 * The auth context owns the session flag / company id via setAuthed / setCompanyId.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

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

/**
 * Auth rides the HttpOnly `omnigestion_token` cookie set by the backend
 * (every fetch uses credentials:'include'). We keep NO token in JS — so an XSS
 * can't steal it. This presence cookie only signals "has a session" for the
 * Next.js middleware (server-side route protection) and the restore-on-mount.
 */
const AUTH_COOKIE = 'omnigestion-auth'

export function isAuthed(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${AUTH_COOKIE}=1`))
}
export function setAuthed(authed: boolean) {
  if (typeof document === 'undefined') return
  document.cookie = authed
    ? `${AUTH_COOKIE}=1; path=/; max-age=604800; SameSite=Lax`
    : `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}
export function getCompanyId(): number | null {
  const raw = readLocal(COMPANY_KEY)
  return raw ? Number(raw) : null
}
export function setCompanyId(id: number | null) {
  writeLocal(COMPANY_KEY, id === null ? null : String(id))
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const companyId = getCompanyId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  // Auth rides the HttpOnly cookie (credentials:'include'). No JS token, no Bearer.
  if (companyId) headers['X-Company-Id'] = String(companyId)

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers, credentials: 'include' })

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
