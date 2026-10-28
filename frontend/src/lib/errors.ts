import type { TFunction } from "i18next"
import i18n from "i18next"

import { ApiError } from "./http"

/** Our own wording for known codes, else the server's (already localised) message. */
export function errorMessage(t: TFunction, error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "validation") return Object.values(error.errors ?? {})[0]?.[0] ?? error.message
    if (i18n.exists(`errors.${error.code}`)) return t(`errors.${error.code}`)
    if (error.message) return error.message
  }
  return t("errors.generic")
}
