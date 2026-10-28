import i18n from "i18next"

/**
 * Thin fetch wrapper for the Laravel API: bearer token, Accept-Language and
 * error normalisation. In dev Vite proxies /api to http://localhost:8000.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1"
const TOKEN_KEY = "clinic-token"

export class ApiError extends Error {
  /** Business-rule code from the backend (slot_taken, …), "validation" or "http_<status>" */
  code: string
  status: number
  errors?: Record<string, string[]>

  constructor(code: string, message: string, status: number, errors?: Record<string, string[]>) {
    super(message)
    this.code = code
    this.status = status
    this.errors = errors
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

type Query = Record<string, string | number | boolean | null | undefined>

export async function http<T>(method: string, path: string, options: { body?: unknown; query?: Query } = {}): Promise<T> {
  const url = new URL(BASE + path, window.location.origin)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
  }

  const token = tokenStore.get()
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Accept-Language": i18n.language === "en" ? "en" : "ar",
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError("network", "", 0)
  }

  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    // Expired or revoked token: drop it and let AuthProvider sign the user out
    if (response.status === 401 && token) {
      tokenStore.set(null)
      window.dispatchEvent(new Event("auth:expired"))
    }
    const code = data.code ?? (response.status === 422 ? "validation" : `http_${response.status}`)
    throw new ApiError(code, data.message ?? "", response.status, data.errors)
  }

  return data as T
}
