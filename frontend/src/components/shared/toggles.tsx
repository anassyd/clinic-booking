import { Languages, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/i18n"
import { useTheme } from "@/providers/theme"

export function LanguageToggle({ className }: { className?: string }) {
  const { t, toggle } = useLocale()
  return (
    <Button variant="ghost" size="sm" onClick={toggle} className={className} aria-label={t("nav.language")}>
      <Languages className="size-4" aria-hidden="true" />
      <span>{t("nav.language")}</span>
    </Button>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useLocale()
  const { resolved, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle} className={className} aria-label={t("nav.theme")}>
      {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
