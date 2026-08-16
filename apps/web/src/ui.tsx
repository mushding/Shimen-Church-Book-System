// ponytail: tiny primitives on native <dialog>/<button> styled with @smsk/ui tokens.
// Swap for shadcn/radix only if a11y needs (focus trap is native in <dialog>).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "ghost" | "danger" | "danger-solid";
const BTN: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg border-primary hover:opacity-90",
  ghost: "border-primary text-primary hover:bg-primary/10",
  danger: "border-danger text-danger hover:bg-danger/10",
  "danger-solid": "bg-danger text-white border-danger hover:opacity-90",
};
export function Button({ variant = "primary", size = "md", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...p}
      className={cx("inline-flex items-center justify-center gap-1 rounded-pill border-2 font-bold whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "px-3 py-1.5 text-xs min-h-[36px]" : "px-4 py-2.5 text-sm min-h-[44px]", BTN[variant], className)}
    />
  );
}

/** Room/category/weekday chip. `color` = tailwind bg class when on. */
export function Chip({ on, color, children, onClick, className, dot }: { on: boolean; color?: string; children: ReactNode; onClick?: () => void; className?: string; dot?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx("inline-flex items-center rounded-pill border-2 px-3 py-1 text-xs font-bold whitespace-nowrap min-h-[28px] select-none transition-colors",
        on ? (color ? `${color} text-white border-transparent` : "bg-primary text-primary-fg border-primary") : "border-border text-muted bg-transparent", className)}>
      {dot && <span className={cx("mr-2 inline-block h-2.5 w-2.5 rounded-[3px]", dot)} />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-primary">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
export function Input({ className, err, ...p }: InputHTMLAttributes<HTMLInputElement> & { err?: boolean }) {
  return <input {...p} className={cx("w-full min-h-[44px] rounded-md border-2 bg-surface px-3.5 py-2.5 text-[15px] text-fg outline-none focus:border-primary", err ? "border-danger" : "border-border", className)} />;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-pill border-2 border-primary">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx("px-3 py-1.5 text-xs font-bold md:px-4 md:py-2 md:text-[13px]", o.value === value ? "bg-primary text-primary-fg" : "text-primary")}>{o.label}</button>
      ))}
    </div>
  );
}

export function Option({ on, onClick, title, note, radio = true }: { on: boolean; onClick: () => void; title: ReactNode; note?: ReactNode; radio?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex w-full items-start gap-3 rounded-md border-2 bg-surface px-3.5 py-3 text-left", on ? "border-primary bg-today" : "border-border")}>
      <span className={cx("mt-0.5 h-[18px] w-[18px] flex-none border-2 border-primary", radio ? "rounded-full" : "rounded-[6px]", on && (radio ? "border-[6px]" : "bg-primary"))} />
      <span className="text-sm"><b>{title}</b>{note && <div className="text-xs text-muted">{note}</div>}</span>
    </button>
  );
}

/** Modal: bottom sheet on mobile, centered card on ≥md. Native <dialog> = focus trap + Esc. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto bg-surface text-fg p-0 backdrop:bg-[rgba(46,74,78,.45)]",
        "fixed bottom-0 top-auto left-0 right-0 rounded-t-[20px] shadow-[0_-12px_32px_rgba(0,0,0,.18)]",
        "md:top-1/2 md:bottom-auto md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:shadow-xl", wide ? "md:max-w-2xl" : "md:max-w-md")}>
      <div className="px-4 pb-5 pt-3 md:p-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border md:hidden" />
        {title !== undefined && (
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-xl font-bold text-primary">{title}</div>
            <button type="button" onClick={onClose} aria-label="關閉" className="px-2 text-xl text-muted">✕</button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}

// ---- toast ----
type Toast = { id: number; kind: "ok" | "err" | "info"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = (kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, kind, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {list.map((t) => (
          <div key={t.id} className={cx("rounded-md px-4 py-3 text-sm font-bold shadow-lg",
            t.kind === "ok" && "bg-primary text-primary-fg", t.kind === "err" && "bg-danger text-white", t.kind === "info" && "border-2 border-border bg-surface text-fg")}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- persisted state ----
export function useLocal<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)); }, [key, v]);
  return [v, setV];
}
export function useDark(): [boolean, () => void] {
  const [dark, setDark] = useLocal<boolean>("smsk.dark", window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return [dark, () => setDark((d) => !d)];
}
export const useIsMobile = () => {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => { const f = () => setM(window.innerWidth < 768); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return m;
};

// Tailwind needs static class strings
export const ROOM_BG: Record<string, string> = {
  "room-1": "bg-room-1", "room-2": "bg-room-2", "room-3": "bg-room-3", "room-4": "bg-room-4", "room-5": "bg-room-5",
  "room-6": "bg-room-6", "room-7": "bg-room-7", "room-8": "bg-room-8", "room-9": "bg-room-9", "room-10": "bg-room-10",
};
export const CAT_BG: Record<string, string> = { "cat-church": "bg-cat-church", "cat-group": "bg-cat-group", "cat-youth": "bg-cat-youth", "cat-young": "bg-cat-young", "cat-kids": "bg-cat-kids", "cat-personal": "bg-cat-personal" };
export const roomBg = (t: string) => ROOM_BG[t] ?? "bg-room-10";
export const catBg = (t: string) => CAT_BG[t] ?? "bg-cat-personal";
