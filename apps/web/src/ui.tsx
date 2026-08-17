// ponytail: tiny primitives on native <dialog>/<button> styled with @smsk/ui tokens.
// Swap for shadcn/radix only if a11y needs (focus trap is native in <dialog>).
// Sizing tuned for 會友 + 長者：body ≥16px, tap targets ≥44px, labels always visible (no icon-only controls).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---- icons: a handful of simple lucide-style strokes; always paired with visible text or aria-label ----
const ICONS = {
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  "chevron-left": "m15 18-6-6 6-6",
  "chevron-right": "m9 18 6-6-6-6",
  sun: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
  "log-out": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  repeat: "m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  text: "M4 7V4h16v3M9 20h6M12 4v16",
  edit: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  grip: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
} as const;
export type IconName = keyof typeof ICONS;
export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)}>
      <path d={ICONS[name]} />
    </svg>
  );
}

// ---- button ----
type Variant = "primary" | "ghost" | "danger" | "danger-solid" | "plain";
const BTN: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg border-primary hover:brightness-95 active:brightness-90",
  ghost: "border-primary text-primary bg-surface hover:bg-primary/10",
  danger: "border-danger text-danger bg-surface hover:bg-danger/10",
  "danger-solid": "bg-danger text-white border-danger hover:brightness-95",
  plain: "border-border text-fg bg-surface hover:bg-primary/10",
};
export function Button({ variant = "primary", size = "md", icon, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; icon?: IconName }) {
  return (
    <button
      type="button"
      {...p}
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-pill border-2 font-bold whitespace-nowrap [transition-property:background-color,border-color,color,filter,transform] active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        size === "sm" ? "px-3.5 py-1.5 text-sm min-h-[40px]" : size === "lg" ? "px-6 py-3 text-lg min-h-[56px]" : "px-5 py-2.5 text-base min-h-[48px]", BTN[variant], className)}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 18 : 20} />}
      {children}
    </button>
  );
}

/** Room/category/weekday chip. `color` = CSS colour (token via cssColor() or hex) used as fill when on; `dot` = CSS colour swatch. */
export function Chip({ on, color, children, onClick, className, dot, size = "md", check }: { on: boolean; color?: string; children: ReactNode; onClick?: () => void; className?: string; dot?: string; size?: "sm" | "md"; check?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={on && color ? { background: color, borderColor: color } : undefined}
      className={cx("inline-flex items-center rounded-pill border-2 font-bold whitespace-nowrap select-none [transition-property:background-color,border-color,color,transform] active:scale-[.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        size === "sm" ? "min-h-[36px] px-3 text-sm" : "min-h-[44px] px-4 text-base",
        on ? (color ? "text-white" : "bg-primary text-primary-fg border-primary") : "border-border text-fg bg-surface", className)}>
      {dot && <span className="mr-2 inline-block h-3 w-3 rounded-[3px]" style={{ background: dot }} />}
      {check && on && <Icon name="check" size={16} className="mr-1 -ml-0.5" />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-bold text-primary">{label}{required && <span className="ml-1 text-danger" aria-hidden="true">＊</span>}</span>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </label>
  );
}
export function Input({ className, err, ...p }: InputHTMLAttributes<HTMLInputElement> & { err?: boolean }) {
  return <input {...p} aria-invalid={err || undefined} className={cx("w-full min-h-[48px] rounded-md border-2 bg-surface px-3.5 py-2.5 text-base text-fg outline-none placeholder:text-muted/70 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30", err ? "border-danger" : "border-border", className)} />;
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: IconName }[]; label?: string; size?: "sm" | "md" }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-pill border-2 border-primary bg-surface">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={cx("inline-flex items-center gap-1 font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
            size === "sm" ? "min-h-[36px] px-3 text-sm" : "min-h-[44px] px-4 text-base", o.value === value ? "bg-primary text-primary-fg" : "text-primary hover:bg-primary/10")}>
          {o.icon && <Icon name={o.icon} size={size === "sm" ? 16 : 18} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Option({ on, onClick, title, note, radio = true }: { on: boolean; onClick: () => void; title: ReactNode; note?: ReactNode; radio?: boolean }) {
  return (
    <button type="button" role={radio ? "radio" : "checkbox"} aria-checked={on} onClick={onClick}
      className={cx("flex w-full items-start gap-3 rounded-md border-2 bg-surface px-4 py-3.5 text-left min-h-[56px] [transition-property:background-color,border-color,transform] active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", on ? "border-primary bg-today" : "border-border")}>
      <span className={cx("mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center border-2 border-primary text-white", radio ? "rounded-full" : "rounded-[6px]",
        // bg-surface + bg-primary 同時存在時 Tailwind 輸出順序讓 surface 蓋掉 primary → 二選一
        on && !radio ? "bg-primary" : "bg-surface", on && radio && "border-[7px]")}>
        {!radio && on && <Icon name="check" size={16} />}
      </span>
      <span className="text-base leading-snug"><b>{title}</b>{note && <div className="mt-0.5 text-sm text-muted">{note}</div>}</span>
    </button>
  );
}

/** Modal: bottom sheet on mobile, centered card on ≥md. Native <dialog> = focus trap + Esc. */
export function Modal({ open, onClose, title, children, wide, icon }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; icon?: IconName }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={(e) => e.target === ref.current && onClose()} /* React bubbles synthetic close from nested dialogs → guard */ onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto bg-surface text-fg p-0 backdrop:bg-[rgba(46,74,78,.5)]",
        "fixed bottom-0 top-auto left-0 right-0 rounded-t-[20px] shadow-[0_-12px_32px_rgba(0,0,0,.18)]",
        "md:top-1/2 md:bottom-auto md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:shadow-xl", wide ? "md:max-w-2xl" : "md:max-w-lg")}>
      <div className="px-4 pb-6 pt-3 md:p-6">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border md:hidden" />
        {title !== undefined && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold text-primary">{icon && <Icon name={icon} size={24} />}<span className="truncate">{title}</span></div>
            <button type="button" onClick={onClose} aria-label="關閉" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-primary/10 hover:text-fg focus-visible:outline-2 focus-visible:outline-primary"><Icon name="x" size={24} /></button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}

// ---- toast: ok/info auto-hide 5s；錯誤留著，要按「知道了」才關（長者看得完） ----
type Toast = { id: number; kind: "ok" | "err" | "info"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const dismiss = (id: number) => setList((l) => l.filter((t) => t.id !== id));
  const push = (kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-2), { id, kind, text }]);
    if (kind !== "err") setTimeout(() => dismiss(id), 5000);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-8">
        {list.map((t) => (
          <div key={t.id} role={t.kind === "err" ? "alert" : "status"} className={cx("anim-in pointer-events-auto flex max-w-md items-center gap-3 rounded-md px-4 py-3 text-base font-bold shadow-lg",
            t.kind === "ok" && "bg-primary text-primary-fg", t.kind === "err" && "bg-danger text-white", t.kind === "info" && "border-2 border-border bg-surface text-fg")}>
            <Icon name={t.kind === "ok" ? "check" : t.kind === "err" ? "alert" : "info"} size={22} />
            <span className="flex-1">{t.text}</span>
            {t.kind === "err" && <button type="button" onClick={() => dismiss(t.id)} className="rounded-pill border-2 border-white/70 px-3 py-1 text-sm whitespace-nowrap">知道了</button>}
          </div>
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
/** 大字模式：html.big-text → 根字級 112.5%（所有 rem 尺寸連動，含日曆）。 */
export function useBigText(): [boolean, () => void] {
  const [big, setBig] = useLocal<boolean>("smsk.bigText", false);
  useEffect(() => { document.documentElement.classList.toggle("big-text", big); }, [big]);
  return [big, () => setBig((b) => !b)];
}
export const useIsMobile = () => {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => { const f = () => setM(window.innerWidth < 768); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return m;
};

// ---- colours: DS token (`room-N` / `cat-xxx` → CSS var) or admin-picked hex ----
export const cssColor = (token: string) => (token.startsWith("#") ? token : `var(--${token})`);
export const ROOM_TOKENS = Array.from({ length: 10 }, (_, i) => `room-${i + 1}`);
export const CAT_TOKENS = ["cat-church", "cat-group", "cat-youth", "cat-young", "cat-kids", "cat-personal"];
/** Resolve a DS token (oklch var) or hex to #rrggbb for <input type=color>. */
export function toHex(token: string): string {
  if (token.startsWith("#")) return token.toLowerCase();
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  // minified CSS may serialise as `oklch(50% .09 225)`
  const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/.exec(raw);
  if (!m) return raw.startsWith("#") ? raw : "#888888";
  return oklchToHex(m[2] ? +m[1] / 100 : +m[1], +m[3], +m[4]);
}
// oklch → sRGB hex (Björn Ottosson's reference math; ~1e-3 accuracy is plenty for a picker seed)
function oklchToHex(L: number, C: number, h: number): string {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, sv = s_ ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sv, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sv, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * sv];
  const gam = (c: number) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
  return "#" + lin.map((c) => Math.round(gam(c) * 255).toString(16).padStart(2, "0")).join("");
}
