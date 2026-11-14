// Toasts for transaction outcomes: each confirmed action links to its explorer page.
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ExternalLink, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface Toast { id: number; kind: "ok" | "error" | "info"; title: string; body?: string; href?: string; hash?: string; linkText?: string }
interface ToastApi { push: (t: Omit<Toast, "id">) => void }
const Ctx = createContext<ToastApi>({ push: () => undefined });
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId++;
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    // A toast that carries a transaction hash stays long enough to read and open it.
    window.setTimeout(() => dismiss(id), t.hash ? 30000 : t.kind === "error" ? 9000 : 6500);
  }, [dismiss]);
  const api = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className={`fixed right-4 z-[70] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 ${import.meta.env.VITE_PREVIEW === "1" ? "bottom-[84px] sm:bottom-24" : "bottom-4"}`} aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }} className="glass flex gap-3 rounded-2xl p-4 shadow-2xl">
              {t.kind === "error" ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-dead" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-alive" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                {t.hash && <p className="mono mt-1.5 break-all text-[11.5px] leading-snug text-text" data-tx-hash={t.hash}>tx {t.hash}</p>}
                {t.href && <a href={t.href} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-sm text-ember hover:underline">{t.linkText ?? "View on explorer"} <ExternalLink className="size-3.5" /></a>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-faint hover:text-text" aria-label="Dismiss"><X className="size-4" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
