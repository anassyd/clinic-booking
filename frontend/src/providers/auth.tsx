import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { getMe } from "@/lib/api"
import { tokenStore } from "@/lib/http"
import type { Role, User } from "@/lib/types"

interface AuthContextValue {
  user: User | null
  signIn: (user: User) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = "clinic-user"

function readUser(): User | null {
  // A cached user without a token is a stale session
  if (!tokenStore.get()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser)

  const signIn = useCallback((next: User) => {
    setUser(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])

  const signOut = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    // The API dropped the token (401) → sign out everywhere
    window.addEventListener("auth:expired", signOut)
    return () => window.removeEventListener("auth:expired", signOut)
  }, [signOut])

  useEffect(() => {
    // Refresh the cached profile once per load (role or name may have changed)
    if (tokenStore.get()) getMe().then(signIn).catch(() => undefined)
  }, [signIn])

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

/** Where each role lands after signing in. */
export const homeFor = (role: Role) =>
  role === "doctor" ? "/doctor" : role === "admin" ? "/admin" : role === "receptionist" ? "/staff" : "/my"
