import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import { Direction } from "radix-ui"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import i18n, { useLocale } from "@/i18n"
import { loadCatalog } from "@/lib/api"
import { AuthProvider } from "@/providers/auth"
import { ThemeProvider } from "@/providers/theme"
import { router } from "@/router"

import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false } },
})

function App() {
  const { dir } = useLocale()
  return (
    <Direction.Provider dir={dir}>
      <TooltipProvider delayDuration={200}>
        {/* reducedMotion="user" makes every motion component honor the OS setting */}
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
        <Toaster position={dir === "rtl" ? "top-left" : "top-right"} richColors closeButton dir={dir} />
      </TooltipProvider>
    </Direction.Provider>
  )
}

const root = createRoot(document.getElementById("root")!)

/** Shown when the API is unreachable at boot — every page needs the doctor catalog. */
function Offline() {
  const ar = i18n.language !== "en"
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 text-center" role="alert">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">{ar ? "تعذّر الاتصال بالخادم" : "Can't reach the server"}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {ar ? "تحقق من اتصالك ثم أعد المحاولة." : "Check your connection and try again."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {ar ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    </div>
  )
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Keeps the boot loader (index.html) up for one full heartbeat, then fades it out before React takes over. */
async function bootLoaderDone() {
  await wait(1600)
  document.querySelector(".boot")?.classList.add("boot-out")
  await wait(250)
}

Promise.all([loadCatalog(), bootLoaderDone()])
  .then(() =>
    root.render(
      <StrictMode>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </StrictMode>,
    ),
  )
  .catch(() => root.render(<Offline />))
